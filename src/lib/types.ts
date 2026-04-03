// === Assessment Dimensions ===

export enum KnowledgeType {
  Factual = 1,
  Conceptual = 2,
  Procedural = 3,
  Metacognitive = 4,
}

export enum CognitiveProcess {
  Remember = 1,
  Understand = 2,
  Apply = 3,
  Analyze = 4,
  Evaluate = 5,
  Create = 6,
}

export enum SoloLevel {
  Prestructural = 0,
  Unistructural = 1,
  Multistructural = 2,
  Relational = 3,
  ExtendedAbstract = 4,
}

export const SOLO_LABELS: Record<SoloLevel, string> = {
  [SoloLevel.Prestructural]: 'Prestructural',
  [SoloLevel.Unistructural]: 'Unistructural',
  [SoloLevel.Multistructural]: 'Multistructural',
  [SoloLevel.Relational]: 'Relational',
  [SoloLevel.ExtendedAbstract]: 'Extended Abstract',
};

export const SOLO_COLORS: Record<SoloLevel, string> = {
  [SoloLevel.Prestructural]: '#ef4444',
  [SoloLevel.Unistructural]: '#f97316',
  [SoloLevel.Multistructural]: '#eab308',
  [SoloLevel.Relational]: '#22c55e',
  [SoloLevel.ExtendedAbstract]: '#3b82f6',
};

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  [KnowledgeType.Factual]: 'Factual',
  [KnowledgeType.Conceptual]: 'Conceptual',
  [KnowledgeType.Procedural]: 'Procedural',
  [KnowledgeType.Metacognitive]: 'Metacognitive',
};

export const KNOWLEDGE_TYPE_SHORT: Record<KnowledgeType, string> = {
  [KnowledgeType.Factual]: 'F',
  [KnowledgeType.Conceptual]: 'C',
  [KnowledgeType.Procedural]: 'P',
  [KnowledgeType.Metacognitive]: 'M',
};

// === Domain Config ===

export interface Layer {
  id: string;
  name: string;
  description: string;
  order: number;
  domain: string;
}

export interface DomainConfig {
  id: string;
  name: string;
  description: string;
  layers: Layer[];
}

// === ZPD State ===

export interface KnowledgeCoverage {
  factual: boolean;
  conceptual: boolean;
  procedural: boolean;
  metacognitive: boolean;
}

export interface CalibrationData {
  recentPredictions: number[];
  recentActuals: number[];
  calibrationGap: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export type BloomMatrix = Record<KnowledgeType, CognitiveProcess>;

export interface ZPDState {
  layerId: string;
  soloLevel: SoloLevel;
  soloConfidence: number;
  soloEvidence: string;
  knowledgeCoverage: KnowledgeCoverage;
  bloomMatrix: BloomMatrix;
  calibration: CalibrationData;
  multistructuralPlateau: boolean;
  plateauSessionCount: number;
  lastAssessed: string;
  attemptHistory: Assessment[];
}

// === Assessment ===

export type AssessmentType = 'diagnostic' | 'exercise' | 'transfer' | 'case-drill' | 'prediction';
export type ResponsePattern = 'and-listing' | 'because-chaining' | 'generalizing';
export type CalibrationLabel = 'overconfident' | 'calibrated' | 'underconfident';

export interface AssessmentDiagnosis {
  knowledgeTypesDemonstrated: KnowledgeType[];
  connectionsMade: number;
  novelConnections: number;
  isMultistructuralPlateau: boolean;
  responsePattern: ResponsePattern;
  metacognitiveCalibration: CalibrationLabel;
  specificGaps: string[];
}

export interface Assessment {
  id: string;
  layerId: string;
  sessionId: string;
  timestamp: string;
  targetCognitiveProcess: CognitiveProcess;
  targetKnowledgeType: KnowledgeType;
  type: AssessmentType;
  prompt: string;
  userResponse: string;
  confidencePrediction: number;
  observedSoloLevel: SoloLevel;
  aiEvaluation: string;
  diagnosis: AssessmentDiagnosis;
  passed: boolean;
  combinedWith?: string[];
}

// === Session ===

export interface Session {
  id: string;
  startTime: string;
  endTime?: string;
  targetLayers: string[];
  soloStart: Record<string, SoloLevel>;
  soloEnd: Record<string, SoloLevel>;
  knowledgeCoverageStart: Record<string, KnowledgeCoverage>;
  knowledgeCoverageEnd: Record<string, KnowledgeCoverage>;
  assessmentCount: number;
  calibrationScore: number;
  plateauDetected: boolean;
  notes: string;
  recommendedNext: string;
  blindSpots: string[];
}

// === Combination Gate ===

export interface CombinationGate {
  layers: string[];
  requiredSoloLevel: SoloLevel;
  requiredKnowledgeCoverage?: KnowledgeType[];
  requireMetacognitive: boolean;
  unlocked: boolean;
}

// === Curriculum Generation ===

export interface GeneratedLayer extends Layer {
  rationale: string;
}

export interface GeneratedCurriculum {
  domainId: string;
  domainName: string;
  domainDescription: string;
  layers: GeneratedLayer[];
}

export type EvolutionType = 'SPLIT' | 'ADD' | 'REORDER' | 'REFINE' | 'MERGE';

export interface EvolutionSuggestion {
  type: EvolutionType;
  targetLayerIds: string[];
  evidence: string;
  description: string;
  proposedLayers: Layer[];
  confidence: 'high' | 'medium' | 'low';
}

export interface EvolutionSuggestions {
  suggestions: EvolutionSuggestion[];
  summary: string;
  insufficientData: boolean;
}

// === Chat Messages ===

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  assessmentId?: string;
  confidencePrompt?: boolean;
}
