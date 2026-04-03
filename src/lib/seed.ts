import { rustMastery } from '@/domains/rust-mastery';
import { KnowledgeType, CognitiveProcess, SoloLevel } from '@/lib/types';
import { upsertLayer, upsertZPDState, getDb } from '@/lib/db';

const initialZPDStates: Record<string, {
  soloLevel: SoloLevel;
  soloConfidence: number;
  knowledgeCoverage: { factual: boolean; conceptual: boolean; procedural: boolean; metacognitive: boolean };
  calibration: { recentPredictions: number[]; recentActuals: number[]; calibrationGap: number; trend: 'improving' | 'stable' | 'degrading' };
  bloomMatrix: Record<KnowledgeType, CognitiveProcess>;
}> = {
  'rust-ownership': {
    soloLevel: SoloLevel.Relational,
    soloConfidence: 0.6,
    knowledgeCoverage: { factual: true, conceptual: true, procedural: false, metacognitive: false },
    calibration: { recentPredictions: [4, 4, 3, 4, 3], recentActuals: [3, 3, 3, 3, 2], calibrationGap: 0.8, trend: 'stable' },
    bloomMatrix: { [KnowledgeType.Factual]: CognitiveProcess.Apply, [KnowledgeType.Conceptual]: CognitiveProcess.Analyze, [KnowledgeType.Procedural]: CognitiveProcess.Understand, [KnowledgeType.Metacognitive]: CognitiveProcess.Remember },
  },
  'rust-systems': {
    soloLevel: SoloLevel.Multistructural,
    soloConfidence: 0.5,
    knowledgeCoverage: { factual: true, conceptual: false, procedural: false, metacognitive: false },
    calibration: { recentPredictions: [3, 3, 2, 3, 3], recentActuals: [3, 2, 2, 3, 3], calibrationGap: 0.2, trend: 'stable' },
    bloomMatrix: { [KnowledgeType.Factual]: CognitiveProcess.Apply, [KnowledgeType.Conceptual]: CognitiveProcess.Understand, [KnowledgeType.Procedural]: CognitiveProcess.Remember, [KnowledgeType.Metacognitive]: CognitiveProcess.Remember },
  },
};

export function seedDatabase() {
  const db = getDb();
  const existingLayers = db.prepare('SELECT COUNT(*) as count FROM layers').get() as { count: number };
  if (existingLayers.count > 0) return false;

  for (const layer of rustMastery.layers) {
    upsertLayer(layer);
  }

  for (const [layerId, state] of Object.entries(initialZPDStates)) {
    upsertZPDState({
      layerId,
      soloLevel: state.soloLevel,
      soloConfidence: state.soloConfidence,
      soloEvidence: '',
      knowledgeCoverage: state.knowledgeCoverage,
      bloomMatrix: state.bloomMatrix,
      calibration: state.calibration,
      multistructuralPlateau: false,
      plateauSessionCount: 0,
      lastAssessed: new Date().toISOString(),
    });
  }

  return true;
}
