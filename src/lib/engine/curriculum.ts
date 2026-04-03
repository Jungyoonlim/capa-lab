import Anthropic from '@anthropic-ai/sdk';
import {
  GeneratedCurriculum,
  EvolutionSuggestions,
  EvolutionSuggestion,
  Layer,
  ZPDState,
  SoloLevel,
  SOLO_LABELS,
} from '@/lib/types';
import { getAllLayers, getAllZPDStates, getAssessmentsByLayer } from '@/lib/db';
import { findBloomGaps } from '@/lib/engine/assessment';

const client = new Anthropic();

// === Generate ===

const GENERATE_SYSTEM_PROMPT = `You are a curriculum architect for a Socratic adaptive learning engine based on Zone of Proximal Development (ZPD) theory. Your job is to decompose a learning topic into a sequence of conceptual layers.

Each layer represents a coherent knowledge cluster that:
1. Can be independently assessed at SOLO taxonomy levels (Prestructural through Extended Abstract)
2. Has enough depth to cover all four knowledge types: Factual, Conceptual, Procedural, and Metacognitive
3. Follows prerequisite ordering — earlier layers are foundations for later ones
4. Is scoped so a learner can move from Prestructural to Relational within 5-10 assessment sessions

Design principles:
- Start with foundational concepts, not overview/introduction layers
- Each layer should have a clear "what you can DO after mastering this" framing
- Descriptions should list the specific subtopics covered (comma-separated)
- Aim for 3-7 layers for most topics. Fewer for narrow topics, more for broad domains.
- Layer IDs should be kebab-case, prefixed with a short domain slug

Respond with ONLY valid JSON matching this schema:
{
  "domainId": "string (kebab-case)",
  "domainName": "string (human-readable)",
  "domainDescription": "string (1-2 sentences)",
  "layers": [
    {
      "id": "string (kebab-case, domain-prefixed)",
      "name": "string",
      "description": "string (comma-separated subtopics)",
      "order": number,
      "rationale": "string (why this layer exists at this position)"
    }
  ]
}`;

export async function generateCurriculum(topic: string): Promise<GeneratedCurriculum> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Decompose this learning topic into a curriculum: "${topic}"`,
      },
    ],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const parsed = JSON.parse(text);

  return {
    domainId: parsed.domainId,
    domainName: parsed.domainName,
    domainDescription: parsed.domainDescription,
    layers: parsed.layers.map((l: { id: string; name: string; description: string; order: number; rationale: string }) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      order: l.order,
      domain: parsed.domainId,
      rationale: l.rationale,
    })),
  };
}

// === Evolve ===

interface LayerPerformance {
  layerId: string;
  layerName: string;
  soloLevel: number;
  soloConfidence: number;
  plateauSessionCount: number;
  multistructuralPlateau: boolean;
  knowledgeCoverage: { factual: boolean; conceptual: boolean; procedural: boolean; metacognitive: boolean };
  bloomGaps: { type: string; maxProcess: number }[];
  totalAssessments: number;
  passRate: number;
  topGaps: { gap: string; count: number }[];
  responsePatterns: Record<string, number>;
}

function aggregateLayerPerformance(
  layer: Layer,
  state: ZPDState | undefined,
  assessments: { diagnosis: { specificGaps?: string[]; responsePattern?: string }; passed: boolean }[]
): LayerPerformance {
  const gapCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  let passed = 0;

  for (const a of assessments) {
    if (a.passed) passed++;
    for (const gap of a.diagnosis?.specificGaps || []) {
      gapCounts[gap] = (gapCounts[gap] || 0) + 1;
    }
    const pattern = a.diagnosis?.responsePattern || 'unknown';
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  }

  const topGaps = Object.entries(gapCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([gap, count]) => ({ gap, count }));

  return {
    layerId: layer.id,
    layerName: layer.name,
    soloLevel: state?.soloLevel ?? 0,
    soloConfidence: state?.soloConfidence ?? 0,
    plateauSessionCount: state?.plateauSessionCount ?? 0,
    multistructuralPlateau: state?.multistructuralPlateau ?? false,
    knowledgeCoverage: state?.knowledgeCoverage ?? { factual: false, conceptual: false, procedural: false, metacognitive: false },
    bloomGaps: state ? findBloomGaps(state.bloomMatrix).map(g => ({ type: String(g.type), maxProcess: g.maxProcess })) : [],
    totalAssessments: assessments.length,
    passRate: assessments.length > 0 ? passed / assessments.length : 0,
    topGaps,
    responsePatterns: patternCounts,
  };
}

const EVOLVE_SYSTEM_PROMPT = `You are a curriculum structure analyst for a ZPD-based adaptive learning engine. You are given the current curriculum layers, learner performance data, and specific gap patterns. Your job is to suggest structural changes to improve learning outcomes.

Types of suggestions you can make:
1. SPLIT: A layer is too broad — split it into 2+ more focused layers
2. ADD: There's a conceptual gap between two existing layers — add an intermediate layer
3. REORDER: Prerequisites are wrong — a layer should come earlier or later
4. REFINE: A layer's description/scope needs adjustment (subtopics added or removed)
5. MERGE: Two layers overlap too much — combine them

For each suggestion, explain:
- What evidence drove the suggestion (specific gaps, plateau data, bloom gaps)
- The exact change proposed
- Expected impact on learning progression

Only suggest changes with clear evidence. If the curriculum is working well, say so.

Respond with ONLY valid JSON matching this schema:
{
  "suggestions": [
    {
      "type": "SPLIT" | "ADD" | "REORDER" | "REFINE" | "MERGE",
      "targetLayerIds": ["string"],
      "evidence": "string (what data patterns indicate this)",
      "description": "string (what to change)",
      "proposedLayers": [
        {
          "id": "string",
          "name": "string",
          "description": "string",
          "order": number
        }
      ],
      "confidence": "high" | "medium" | "low"
    }
  ],
  "summary": "string (overall curriculum health assessment)"
}`;

export async function analyzeCurriculumEvolution(domainId: string): Promise<EvolutionSuggestions> {
  const layers = getAllLayers(domainId) as Layer[];
  if (layers.length === 0) {
    return { suggestions: [], summary: 'No layers found for this domain.', insufficientData: true };
  }

  const allStates = getAllZPDStates();
  const stateMap: Record<string, ZPDState> = {};
  for (const s of allStates) {
    stateMap[s.layerId] = s as unknown as ZPDState;
  }

  const performances: LayerPerformance[] = [];
  let totalAssessments = 0;

  for (const layer of layers) {
    const assessments = getAssessmentsByLayer(layer.id, 50);
    totalAssessments += assessments.length;
    performances.push(aggregateLayerPerformance(layer, stateMap[layer.id], assessments));
  }

  if (totalAssessments < 10) {
    return {
      suggestions: [],
      summary: `Only ${totalAssessments} assessments recorded. Need at least 10 before curriculum evolution analysis is meaningful.`,
      insufficientData: true,
    };
  }

  const currentCurriculum = layers.map(l => ({
    id: l.id,
    name: l.name,
    description: l.description,
    order: l.order,
  }));

  const performanceData = performances.map(p => ({
    layerId: p.layerId,
    soloLevel: `${SOLO_LABELS[p.soloLevel as SoloLevel]} (confidence: ${p.soloConfidence.toFixed(1)})`,
    plateauSessionCount: p.plateauSessionCount,
    multistructuralPlateau: p.multistructuralPlateau,
    passRate: `${(p.passRate * 100).toFixed(0)}%`,
    totalAssessments: p.totalAssessments,
    knowledgeCoverage: p.knowledgeCoverage,
    bloomGaps: p.bloomGaps,
  }));

  const gapPatterns = performances.map(p => ({
    layerId: p.layerId,
    topGaps: p.topGaps,
    responsePatterns: p.responsePatterns,
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: EVOLVE_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `<current_curriculum>\n${JSON.stringify(currentCurriculum, null, 2)}\n</current_curriculum>\n\n<performance_data>\n${JSON.stringify(performanceData, null, 2)}\n</performance_data>\n\n<gap_patterns>\n${JSON.stringify(gapPatterns, null, 2)}\n</gap_patterns>\n\nAnalyze this curriculum and suggest structural improvements.`,
      },
    ],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const parsed = JSON.parse(text);

  return {
    suggestions: (parsed.suggestions || []).map((s: EvolutionSuggestion) => ({
      type: s.type,
      targetLayerIds: s.targetLayerIds,
      evidence: s.evidence,
      description: s.description,
      proposedLayers: (s.proposedLayers || []).map((l: Layer & { domain?: string }) => ({
        id: l.id,
        name: l.name,
        description: l.description,
        order: l.order,
        domain: l.domain || domainId,
      })),
      confidence: s.confidence,
    })),
    summary: parsed.summary,
    insufficientData: false,
  };
}
