import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import {
  getSession,
  getChatMessages,
  createChatMessage,
  createAssessment,
  updateAssessment,
  getAssessmentsBySession,
  getAllLayers,
  getAllZPDStates,
  getZPDState,
  upsertZPDState,
  updateSession,
} from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import {
  buildSystemPrompt,
  sendTutorMessage,
  generateDiagnostic,
} from '@/lib/claude';
import {
  determineNextAssessmentType,
  determineTargetBloom,
  processAssessment,
} from '@/lib/engine/assessment';
import {
  SoloLevel,
  KnowledgeType,
  CognitiveProcess,
  ZPDState,
  Layer,
  Assessment,
} from '@/lib/types';

const KNOWLEDGE_TYPE_MAP: Record<string, KnowledgeType> = {
  Factual: KnowledgeType.Factual,
  Conceptual: KnowledgeType.Conceptual,
  Procedural: KnowledgeType.Procedural,
  Metacognitive: KnowledgeType.Metacognitive,
};

const COGNITIVE_PROCESS_MAP: Record<string, CognitiveProcess> = {
  Remember: CognitiveProcess.Remember,
  Understand: CognitiveProcess.Understand,
  Apply: CognitiveProcess.Apply,
  Analyze: CognitiveProcess.Analyze,
  Evaluate: CognitiveProcess.Evaluate,
  Create: CognitiveProcess.Create,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  seedDatabase();
  const { id: sessionId } = await params;

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const body = await request.json();
  const { content } = body as { content: string };

  // Save user message
  const userMsgId = uuid();
  createChatMessage({
    id: userMsgId,
    sessionId,
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  });

  // Get context
  const layers = getAllLayers() as Layer[];
  const zpdStatesArr = getAllZPDStates();
  const zpdStates: Record<string, ZPDState> = {};
  for (const s of zpdStatesArr) {
    zpdStates[s.layerId] = s as unknown as ZPDState;
  }

  const targetLayerId = session.targetLayers[0];
  const targetLayer = layers.find(l => l.id === targetLayerId)!;
  const state = zpdStates[targetLayerId];

  const existingMessages = getChatMessages(sessionId);
  const assessments = getAssessmentsBySession(sessionId);

  // Determine assessment targeting
  const assessmentType = determineNextAssessmentType(state, assessments.length);
  const bloomTarget = determineTargetBloom(state);
  const targetSoloLevel = Math.min(state.soloLevel + 1, SoloLevel.ExtendedAbstract) as SoloLevel;

  const systemPrompt = buildSystemPrompt(
    layers,
    zpdStates,
    targetLayer,
    bloomTarget.knowledgeType,
    bloomTarget.cognitiveProcess,
    targetSoloLevel,
    assessmentType,
    state.multistructuralPlateau
  );

  // Build message history for Claude
  const chatHistory = existingMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  let response;

  if (chatHistory.length <= 1) {
    // First message - generate diagnostic
    response = await generateDiagnostic(systemPrompt, targetLayer.name, state.soloLevel as SoloLevel);
  } else {
    response = await sendTutorMessage(systemPrompt, chatHistory);
  }

  // Save assistant message
  const assistantMsgId = uuid();
  createChatMessage({
    id: assistantMsgId,
    sessionId,
    role: 'assistant',
    content: response.conversation,
    timestamp: new Date().toISOString(),
  });

  // Process assessment if present
  let assessmentResult = null;
  if (response.assessment) {
    const a = response.assessment;
    const assessmentId = uuid();

    const knowledgeTypesDemonstrated = (a.knowledgeTypesDemonstrated || [])
      .map(kt => KNOWLEDGE_TYPE_MAP[kt])
      .filter(Boolean);

    const assessment: Assessment = {
      id: assessmentId,
      layerId: targetLayerId,
      sessionId,
      timestamp: new Date().toISOString(),
      targetCognitiveProcess: bloomTarget.cognitiveProcess,
      targetKnowledgeType: bloomTarget.knowledgeType,
      type: assessmentType,
      prompt: content,
      userResponse: content,
      confidencePrediction: 0,
      observedSoloLevel: a.observedSoloLevel as SoloLevel,
      aiEvaluation: a.soloEvidence,
      diagnosis: {
        knowledgeTypesDemonstrated,
        connectionsMade: a.connectionsMade || 0,
        novelConnections: a.novelConnections || 0,
        isMultistructuralPlateau: a.isMultistructuralPlateau || false,
        responsePattern: (a.responsePattern as 'and-listing' | 'because-chaining' | 'generalizing') || 'and-listing',
        metacognitiveCalibration: (a.metacognitiveCalibration as 'overconfident' | 'calibrated' | 'underconfident') || 'calibrated',
        specificGaps: a.specificGaps || [],
      },
      passed: a.observedSoloLevel >= state.soloLevel,
    };

    createAssessment(assessment);

    // Update ZPD state
    const updates = processAssessment(state, assessment);
    const currentState = getZPDState(targetLayerId);
    if (currentState) {
      upsertZPDState({
        layerId: targetLayerId,
        soloLevel: updates.soloLevel ?? currentState.soloLevel,
        soloConfidence: updates.soloConfidence ?? currentState.soloConfidence,
        soloEvidence: updates.soloEvidence ?? currentState.soloEvidence,
        knowledgeCoverage: updates.knowledgeCoverage ?? currentState.knowledgeCoverage,
        bloomMatrix: updates.bloomMatrix ?? currentState.bloomMatrix,
        calibration: updates.calibration ?? currentState.calibration,
        multistructuralPlateau: updates.multistructuralPlateau ?? currentState.multistructuralPlateau,
        plateauSessionCount: updates.plateauSessionCount ?? currentState.plateauSessionCount,
        lastAssessed: updates.lastAssessed ?? currentState.lastAssessed,
      });
    }

    // Update session assessment count
    updateSession(sessionId, { assessmentCount: assessments.length + 1 });

    assessmentResult = {
      observedSoloLevel: a.observedSoloLevel,
      soloEvidence: a.soloEvidence,
      knowledgeTypesDemonstrated: a.knowledgeTypesDemonstrated,
      responsePattern: a.responsePattern,
      metacognitiveCalibration: a.metacognitiveCalibration,
      passed: assessment.passed,
    };
  }

  return NextResponse.json({
    message: {
      id: assistantMsgId,
      role: 'assistant',
      content: response.conversation,
      timestamp: new Date().toISOString(),
    },
    assessment: assessmentResult,
  });
}
