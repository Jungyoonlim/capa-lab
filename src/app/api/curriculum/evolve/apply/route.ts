import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import {
  upsertLayer,
  upsertZPDState,
  deleteLayer,
  reassignAssessments,
  getAllLayers,
} from '@/lib/db';
import {
  EvolutionSuggestion,
  Layer,
  KnowledgeType,
  CognitiveProcess,
  SoloLevel,
} from '@/lib/types';

function createFreshZPDState(layerId: string) {
  upsertZPDState({
    layerId,
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

export async function POST(request: NextRequest) {
  seedDatabase();

  const body = await request.json();
  const { domainId, suggestion } = body as { domainId: string; suggestion: EvolutionSuggestion };

  if (!domainId || !suggestion) {
    return NextResponse.json({ error: 'domainId and suggestion are required' }, { status: 400 });
  }

  const affectedLayers: string[] = [];

  switch (suggestion.type) {
    case 'SPLIT': {
      // Delete old layer, add new ones
      const targetId = suggestion.targetLayerIds[0];
      for (const newLayer of suggestion.proposedLayers) {
        upsertLayer({ ...newLayer, domain: domainId });
        createFreshZPDState(newLayer.id);
        affectedLayers.push(newLayer.id);
      }
      // Reassign assessments to the first new layer
      reassignAssessments(targetId, suggestion.proposedLayers[0].id);
      deleteLayer(targetId);
      break;
    }

    case 'ADD': {
      for (const newLayer of suggestion.proposedLayers) {
        upsertLayer({ ...newLayer, domain: domainId });
        createFreshZPDState(newLayer.id);
        affectedLayers.push(newLayer.id);
      }
      // Reorder existing layers to make room
      const allLayers = getAllLayers(domainId) as Layer[];
      const sorted = allLayers.sort((a, b) => a.order - b.order);
      sorted.forEach((layer, idx) => {
        upsertLayer({ ...layer, order: idx + 1 });
      });
      break;
    }

    case 'REORDER': {
      for (const layer of suggestion.proposedLayers) {
        upsertLayer({ ...layer, domain: domainId });
        affectedLayers.push(layer.id);
      }
      break;
    }

    case 'REFINE': {
      for (const layer of suggestion.proposedLayers) {
        upsertLayer({ ...layer, domain: domainId });
        affectedLayers.push(layer.id);
      }
      break;
    }

    case 'MERGE': {
      // Keep first target, merge second into it
      const [keepId, removeId] = suggestion.targetLayerIds;
      if (suggestion.proposedLayers.length > 0) {
        const merged = suggestion.proposedLayers[0];
        upsertLayer({ ...merged, id: keepId, domain: domainId });
      }
      reassignAssessments(removeId, keepId);
      deleteLayer(removeId);
      affectedLayers.push(keepId);
      break;
    }
  }

  return NextResponse.json({ applied: true, affectedLayers });
}
