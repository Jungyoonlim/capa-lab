import {
  SoloLevel,
  KnowledgeType,
  CognitiveProcess,
  Assessment,
  ZPDState,
  CalibrationData,
  CalibrationLabel,
  AssessmentType,
  KnowledgeCoverage,
  BloomMatrix,
} from '@/lib/types';

// === Level Advancement ===

const ADVANCEMENT_WINDOW = 3;
const DEMOTION_WINDOW = 2;
const PLATEAU_THRESHOLD = 3;
const CALIBRATION_OVERCONFIDENT_THRESHOLD = 1.0;

export function shouldAdvance(assessments: Assessment[], currentLevel: SoloLevel): boolean {
  if (assessments.length < ADVANCEMENT_WINDOW) return false;

  const recent = assessments.slice(-ADVANCEMENT_WINDOW);
  const nextLevel = currentLevel + 1;

  const allAtNextLevel = recent.every(a => a.observedSoloLevel >= nextLevel);
  const hasTransfer = recent.some(a => a.type === 'transfer');

  return allAtNextLevel && hasTransfer;
}

export function shouldDemote(assessments: Assessment[], currentLevel: SoloLevel): boolean {
  if (assessments.length < DEMOTION_WINDOW) return false;

  const recent = assessments.slice(-DEMOTION_WINDOW);
  return recent.every(a => a.observedSoloLevel < currentLevel);
}

export function detectMultistructuralPlateau(state: ZPDState): boolean {
  return (
    state.soloLevel === SoloLevel.Multistructural &&
    state.plateauSessionCount >= PLATEAU_THRESHOLD
  );
}

// === Knowledge Coverage Update ===

export function updateKnowledgeCoverage(
  current: KnowledgeCoverage,
  demonstrated: KnowledgeType[]
): KnowledgeCoverage {
  return {
    factual: current.factual || demonstrated.includes(KnowledgeType.Factual),
    conceptual: current.conceptual || demonstrated.includes(KnowledgeType.Conceptual),
    procedural: current.procedural || demonstrated.includes(KnowledgeType.Procedural),
    metacognitive: current.metacognitive || demonstrated.includes(KnowledgeType.Metacognitive),
  };
}

export function countKnowledgeCoverage(coverage: KnowledgeCoverage): number {
  return [coverage.factual, coverage.conceptual, coverage.procedural, coverage.metacognitive]
    .filter(Boolean).length;
}

export function canAdvanceWithCoverage(coverage: KnowledgeCoverage): boolean {
  return countKnowledgeCoverage(coverage) >= 3;
}

// === Bloom Matrix Update ===

export function updateBloomMatrix(
  current: BloomMatrix,
  knowledgeType: KnowledgeType,
  cognitiveProcess: CognitiveProcess
): BloomMatrix {
  const updated = { ...current };
  if (!updated[knowledgeType] || cognitiveProcess > updated[knowledgeType]) {
    updated[knowledgeType] = cognitiveProcess;
  }
  return updated;
}

export function findBloomGaps(matrix: BloomMatrix): { type: KnowledgeType; maxProcess: CognitiveProcess }[] {
  const gaps: { type: KnowledgeType; maxProcess: CognitiveProcess }[] = [];
  const types = [KnowledgeType.Factual, KnowledgeType.Conceptual, KnowledgeType.Procedural, KnowledgeType.Metacognitive];
  const maxProcess = Math.max(...types.map(t => matrix[t] || CognitiveProcess.Remember));

  for (const type of types) {
    const current = matrix[type] || CognitiveProcess.Remember;
    if (current < maxProcess - 1) {
      gaps.push({ type, maxProcess: current });
    }
  }
  return gaps;
}

// === Calibration ===

export function updateCalibration(
  current: CalibrationData,
  prediction: number,
  actual: number
): CalibrationData {
  const predictions = [...current.recentPredictions, prediction].slice(-10);
  const actuals = [...current.recentActuals, actual].slice(-10);

  const gaps = predictions.map((p, i) => p - actuals[i]);
  const calibrationGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;

  // Determine trend by comparing first half to second half
  let trend: CalibrationData['trend'] = 'stable';
  if (gaps.length >= 4) {
    const mid = Math.floor(gaps.length / 2);
    const firstHalf = gaps.slice(0, mid).map(Math.abs);
    const secondHalf = gaps.slice(mid).map(Math.abs);
    const firstAvg = firstHalf.reduce((s, g) => s + g, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, g) => s + g, 0) / secondHalf.length;

    if (secondAvg < firstAvg - 0.3) trend = 'improving';
    else if (secondAvg > firstAvg + 0.3) trend = 'degrading';
  }

  return { recentPredictions: predictions, recentActuals: actuals, calibrationGap, trend };
}

export function getCalibrationLabel(gap: number): CalibrationLabel {
  if (gap > CALIBRATION_OVERCONFIDENT_THRESHOLD) return 'overconfident';
  if (gap < -CALIBRATION_OVERCONFIDENT_THRESHOLD) return 'underconfident';
  return 'calibrated';
}

// === Assessment Routing ===

export function determineNextAssessmentType(
  state: ZPDState,
  sessionAssessmentCount: number
): AssessmentType {
  // First assessment is always diagnostic
  if (sessionAssessmentCount === 0) return 'diagnostic';

  // Every 3rd exercise is transfer
  if ((sessionAssessmentCount + 1) % 3 === 0) return 'transfer';

  // Case-drill for systems-heavy layers
  if (state.layerId === 'rust-systems' && sessionAssessmentCount % 4 === 2) {
    return 'case-drill';
  }

  // Prediction exercises for metacognitive calibration
  if (Math.abs(state.calibration.calibrationGap) > CALIBRATION_OVERCONFIDENT_THRESHOLD) {
    return 'prediction';
  }

  return 'exercise';
}

export function determineTargetBloom(state: ZPDState): {
  knowledgeType: KnowledgeType;
  cognitiveProcess: CognitiveProcess;
} {
  // Find the weakest knowledge type in the bloom matrix
  const gaps = findBloomGaps(state.bloomMatrix);
  if (gaps.length > 0) {
    const weakest = gaps[0];
    return {
      knowledgeType: weakest.type,
      cognitiveProcess: Math.min(weakest.maxProcess + 1, CognitiveProcess.Create) as CognitiveProcess,
    };
  }

  // Default: push the lowest knowledge type up one cognitive process level
  const types = [KnowledgeType.Factual, KnowledgeType.Conceptual, KnowledgeType.Procedural, KnowledgeType.Metacognitive];
  let lowestType = KnowledgeType.Factual;
  let lowestProcess = CognitiveProcess.Create;
  for (const type of types) {
    const process = state.bloomMatrix[type] || CognitiveProcess.Remember;
    if (process < lowestProcess) {
      lowestProcess = process;
      lowestType = type;
    }
  }

  return {
    knowledgeType: lowestType,
    cognitiveProcess: Math.min(lowestProcess + 1, CognitiveProcess.Create) as CognitiveProcess,
  };
}

// === ZPD State Update (after assessment) ===

export function processAssessment(
  state: ZPDState,
  assessment: Assessment
): Partial<ZPDState> {
  const updates: Partial<ZPDState> = {};
  const history = [...(state.attemptHistory || []), assessment];

  // Update calibration
  if (assessment.confidencePrediction > 0) {
    updates.calibration = updateCalibration(
      state.calibration,
      assessment.confidencePrediction,
      assessment.observedSoloLevel
    );
  }

  // Update knowledge coverage
  if (assessment.diagnosis?.knowledgeTypesDemonstrated) {
    updates.knowledgeCoverage = updateKnowledgeCoverage(
      state.knowledgeCoverage,
      assessment.diagnosis.knowledgeTypesDemonstrated
    );
  }

  // Update bloom matrix
  if (assessment.passed) {
    updates.bloomMatrix = updateBloomMatrix(
      state.bloomMatrix,
      assessment.targetKnowledgeType,
      assessment.targetCognitiveProcess
    );
  }

  // Check for advancement
  const recentForAdvancement = history.slice(-ADVANCEMENT_WINDOW);
  if (shouldAdvance(recentForAdvancement, state.soloLevel) && canAdvanceWithCoverage(updates.knowledgeCoverage || state.knowledgeCoverage)) {
    updates.soloLevel = (state.soloLevel + 1) as SoloLevel;
    updates.soloEvidence = assessment.aiEvaluation;
    updates.soloConfidence = 0.5; // Reset on advancement
    updates.plateauSessionCount = 0;
    updates.multistructuralPlateau = false;
  }
  // Check for demotion
  else if (shouldDemote(history.slice(-DEMOTION_WINDOW), state.soloLevel)) {
    updates.soloLevel = (state.soloLevel - 1) as SoloLevel;
    updates.soloEvidence = assessment.aiEvaluation;
    updates.soloConfidence = Math.max(0, state.soloConfidence - 0.2);
  }
  // Update confidence
  else {
    const performedAtLevel = assessment.observedSoloLevel >= state.soloLevel;
    const delta = performedAtLevel ? 0.05 : -0.1;
    updates.soloConfidence = Math.max(0, Math.min(1, state.soloConfidence + delta));
  }

  // Plateau detection
  if (assessment.diagnosis?.isMultistructuralPlateau) {
    updates.multistructuralPlateau = true;
  }

  updates.lastAssessed = new Date().toISOString();

  return updates;
}
