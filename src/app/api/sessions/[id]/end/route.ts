import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession, getAssessmentsBySession, getAllZPDStates, getZPDState, upsertZPDState } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { SoloLevel, ZPDState } from '@/lib/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  seedDatabase();
  const { id: sessionId } = await params;

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const assessments = getAssessmentsBySession(sessionId);

  // Compute end state
  const soloEnd: Record<string, number> = {};
  const knowledgeCoverageEnd: Record<string, object> = {};

  for (const layerId of session.targetLayers) {
    const state = getZPDState(layerId);
    if (state) {
      soloEnd[layerId] = state.soloLevel;
      knowledgeCoverageEnd[layerId] = state.knowledgeCoverage;

      // Update plateau session count for multistructural layers
      if (state.soloLevel === SoloLevel.Multistructural) {
        upsertZPDState({
          ...state,
          plateauSessionCount: state.plateauSessionCount + 1,
          multistructuralPlateau: state.plateauSessionCount + 1 >= 3,
        });
      }
    }
  }

  // Compute calibration score
  let calibrationScore = 0;
  const withPredictions = assessments.filter(a => a.confidencePrediction > 0);
  if (withPredictions.length > 0) {
    calibrationScore = withPredictions.reduce(
      (sum, a) => sum + Math.abs(a.confidencePrediction - (a.observedSoloLevel || 0)),
      0
    ) / withPredictions.length;
  }

  const plateauDetected = assessments.some(a => a.diagnosis?.isMultistructuralPlateau);

  // Generate notes and recommendations
  const layerSummaries = session.targetLayers.map((layerId: string) => {
    const startLevel = session.soloStart[layerId];
    const endLevel = soloEnd[layerId];
    const moved = endLevel !== startLevel;
    return `${layerId}: ${SoloLevel[startLevel]} → ${SoloLevel[endLevel]}${moved ? ' (moved!)' : ''}`;
  });

  const blindSpots = assessments
    .flatMap(a => a.diagnosis?.specificGaps || [])
    .filter((v, i, arr) => arr.indexOf(v) === i);

  updateSession(sessionId, {
    endTime: new Date().toISOString(),
    soloEnd,
    knowledgeCoverageEnd,
    assessmentCount: assessments.length,
    calibrationScore,
    plateauDetected,
    notes: `Completed ${assessments.length} assessments. ${layerSummaries.join('. ')}`,
    recommendedNext: generateRecommendation(session.targetLayers, soloEnd, plateauDetected),
    blindSpots,
  });

  const updatedSession = getSession(sessionId);
  return NextResponse.json({ session: updatedSession, assessments });
}

function generateRecommendation(
  targetLayers: string[],
  soloEnd: Record<string, number>,
  plateauDetected: boolean
): string {
  if (plateauDetected) {
    return 'Focus on relational exercises — practice connecting concepts with "because" chains rather than listing facts.';
  }

  const lowestLayer = targetLayers.reduce((lowest, layerId) => {
    const level = soloEnd[layerId] ?? 0;
    const lowestLevel = soloEnd[lowest] ?? 0;
    return level < lowestLevel ? layerId : lowest;
  }, targetLayers[0]);

  const level = soloEnd[lowestLayer] ?? 0;
  if (level <= SoloLevel.Unistructural) {
    return `Continue building foundational knowledge in ${lowestLayer}. Focus on factual and conceptual coverage.`;
  }
  if (level === SoloLevel.Multistructural) {
    return `Push ${lowestLayer} toward Relational — practice explaining WHY and HOW, not just WHAT.`;
  }
  return `Consider combining ${lowestLayer} with another layer for integration exercises.`;
}
