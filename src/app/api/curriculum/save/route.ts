import { NextRequest, NextResponse } from 'next/server';
import { upsertLayer, upsertZPDState, getAllLayers } from '@/lib/db';
import { GeneratedCurriculum, KnowledgeType, CognitiveProcess, SoloLevel } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { curriculum } = body as { curriculum: GeneratedCurriculum };

  if (!curriculum || !curriculum.layers || curriculum.layers.length === 0) {
    return NextResponse.json({ error: 'curriculum with layers is required' }, { status: 400 });
  }

  // Check for domain ID conflict
  const existing = getAllLayers(curriculum.domainId) as { id: string }[];
  if (existing.length > 0) {
    return NextResponse.json({ error: `Domain "${curriculum.domainId}" already exists` }, { status: 409 });
  }

  for (const layer of curriculum.layers) {
    upsertLayer({
      id: layer.id,
      name: layer.name,
      description: layer.description,
      order: layer.order,
      domain: curriculum.domainId,
    });

    upsertZPDState({
      layerId: layer.id,
      soloLevel: SoloLevel.Prestructural,
      soloConfidence: 0,
      soloEvidence: '',
      knowledgeCoverage: { factual: false, conceptual: false, procedural: false, metacognitive: false },
      bloomMatrix: {
        [KnowledgeType.Factual]: CognitiveProcess.Remember,
        [KnowledgeType.Conceptual]: CognitiveProcess.Remember,
        [KnowledgeType.Procedural]: CognitiveProcess.Remember,
        [KnowledgeType.Metacognitive]: CognitiveProcess.Remember,
      },
      calibration: { recentPredictions: [], recentActuals: [], calibrationGap: 0, trend: 'stable' as const },
      multistructuralPlateau: false,
      plateauSessionCount: 0,
      lastAssessed: '',
    });
  }

  return NextResponse.json({
    domain: {
      id: curriculum.domainId,
      name: curriculum.domainName,
      description: curriculum.domainDescription,
    },
    layerCount: curriculum.layers.length,
  });
}
