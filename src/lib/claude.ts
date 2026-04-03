import Anthropic from '@anthropic-ai/sdk';
import {
  ZPDState,
  Layer,
  SoloLevel,
  KnowledgeType,
  CognitiveProcess,
  AssessmentType,
  SOLO_LABELS,
  KNOWLEDGE_TYPE_LABELS,
} from '@/lib/types';

const client = new Anthropic();

// === System Prompt Construction ===

function buildTutorProtocol(plateauDetected: boolean): string {
  const base = `You are a Socratic tutor. Your approach:
- Never give answers directly. Guide through questions.
- Start every exercise with a prediction prompt: ask the learner to predict their confidence (1-5) BEFORE attempting.
- After their response, evaluate the quality of understanding, not just correctness.
- Focus on WHY and HOW, not just WHAT.
- When the learner is stuck, provide scaffolding (hints that narrow the problem) rather than solutions.
- Track whether they're listing facts (Multistructural) vs connecting them (Relational).`;

  if (plateauDetected) {
    return base + `

IMPORTANT — MULTISTRUCTURAL PLATEAU DETECTED:
The learner is stuck listing facts without connecting them. They can enumerate aspects but don't explain causal relationships.
- Do NOT ask "list" or "describe" questions.
- Instead ask: "How does X cause Y?", "Why does this lead to that?", "What would happen if X changed?"
- Push for "because" chains, not "and" lists.
- Explicitly point out when they're listing without connecting.`;
  }

  return base;
}

function buildZPDContext(layers: Layer[], zpdStates: Record<string, ZPDState>): string {
  const lines = layers.map(layer => {
    const state = zpdStates[layer.id];
    if (!state) return `${layer.name}: No data`;

    const coverage = state.knowledgeCoverage;
    const coverageStr = [
      coverage.factual ? 'F✓' : 'F✗',
      coverage.conceptual ? 'C✓' : 'C✗',
      coverage.procedural ? 'P✓' : 'P✗',
      coverage.metacognitive ? 'M✓' : 'M✗',
    ].join(' ');

    const calLabel = state.calibration.calibrationGap > 1 ? 'overconfident'
      : state.calibration.calibrationGap < -1 ? 'underconfident' : 'calibrated';

    return `${layer.name}: SOLO ${SOLO_LABELS[state.soloLevel as SoloLevel]} (confidence: ${state.soloConfidence.toFixed(1)}) | Knowledge: ${coverageStr} | Calibration: ${calLabel}${state.multistructuralPlateau ? ' | ⚠️ PLATEAU' : ''}`;
  });

  return `Current learner ZPD state:\n${lines.join('\n')}`;
}

function buildSessionGoal(
  targetLayer: Layer,
  targetKnowledgeType: KnowledgeType,
  targetCognitiveProcess: CognitiveProcess,
  targetSoloLevel: SoloLevel,
  assessmentType: AssessmentType
): string {
  return `Session goal:
- Layer: ${targetLayer.name}
- Target knowledge type: ${KNOWLEDGE_TYPE_LABELS[targetKnowledgeType]}
- Target cognitive process: ${['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'][targetCognitiveProcess - 1]}
- Push toward SOLO level: ${SOLO_LABELS[targetSoloLevel]}
- Assessment type: ${assessmentType}`;
}

function buildAssessmentInstructions(): string {
  return `When evaluating the learner's response, you MUST include a JSON assessment block in your response.
Place it at the very end of your message, after your conversational response, wrapped in <assessment> tags:

<assessment>
{
  "observedSoloLevel": 0-4,
  "soloEvidence": "string explaining what structural quality the response showed",
  "knowledgeTypesDemonstrated": ["Factual", "Conceptual", "Procedural", "Metacognitive"],
  "connectionsMade": number,
  "novelConnections": number,
  "isMultistructuralPlateau": boolean,
  "responsePattern": "and-listing" | "because-chaining" | "generalizing",
  "specificGaps": ["gap1", "gap2"],
  "metacognitiveCalibration": "overconfident" | "calibrated" | "underconfident",
  "nextQuestion": "the follow-up question or exercise",
  "nextQuestionTarget": { "knowledgeType": "Factual|Conceptual|Procedural|Metacognitive", "cognitiveProcess": "Remember|Understand|Apply|Analyze|Evaluate|Create" }
}
</assessment>

SOLO Level guide for assessment:
0 (Prestructural): Misses the point entirely. Wrong concept applied.
1 (Unistructural): Gets ONE relevant aspect, in isolation.
2 (Multistructural): Gets SEVERAL aspects but DOESN'T CONNECT them. Lists without linking.
3 (Relational): Integrates aspects into a coherent whole. Explains WHY, shows causal chains.
4 (Extended Abstract): Generalizes beyond taught context. Creates novel cross-domain connections.`;
}

export function buildSystemPrompt(
  layers: Layer[],
  zpdStates: Record<string, ZPDState>,
  targetLayer: Layer,
  targetKnowledgeType: KnowledgeType,
  targetCognitiveProcess: CognitiveProcess,
  targetSoloLevel: SoloLevel,
  assessmentType: AssessmentType,
  plateauDetected: boolean
): string {
  return [
    buildTutorProtocol(plateauDetected),
    '',
    buildZPDContext(layers, zpdStates),
    '',
    buildSessionGoal(targetLayer, targetKnowledgeType, targetCognitiveProcess, targetSoloLevel, assessmentType),
    '',
    buildAssessmentInstructions(),
  ].join('\n');
}

// === API Calls ===

export interface TutorResponse {
  conversation: string;
  assessment?: {
    observedSoloLevel: number;
    soloEvidence: string;
    knowledgeTypesDemonstrated: string[];
    connectionsMade: number;
    novelConnections: number;
    isMultistructuralPlateau: boolean;
    responsePattern: string;
    specificGaps: string[];
    metacognitiveCalibration: string;
    nextQuestion: string;
    nextQuestionTarget: {
      knowledgeType: string;
      cognitiveProcess: string;
    };
  };
}

function parseResponse(text: string): TutorResponse {
  const assessmentMatch = text.match(/<assessment>\s*([\s\S]*?)\s*<\/assessment>/);

  if (assessmentMatch) {
    const conversation = text.replace(/<assessment>[\s\S]*?<\/assessment>/, '').trim();
    try {
      const assessment = JSON.parse(assessmentMatch[1]);
      return { conversation, assessment };
    } catch {
      return { conversation: text.trim() };
    }
  }

  return { conversation: text.trim() };
}

export async function sendTutorMessage(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<TutorResponse> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  return parseResponse(text);
}

export async function generateDiagnostic(
  systemPrompt: string,
  layerName: string,
  soloLevel: SoloLevel
): Promise<TutorResponse> {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [
    {
      role: 'user',
      content: `I'm ready to start. Please give me a diagnostic exercise for "${layerName}" at ${SOLO_LABELS[soloLevel]} level. Remember to ask for my confidence prediction first.`,
    },
  ];

  return sendTutorMessage(systemPrompt, messages);
}
