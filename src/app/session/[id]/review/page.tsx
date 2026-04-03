'use client';

import { useEffect, useState, use } from 'react';
import { SOLO_LABELS, SOLO_COLORS, SoloLevel } from '@/lib/types';

interface SessionReview {
  session: {
    id: string;
    startTime: string;
    endTime: string;
    targetLayers: string[];
    soloStart: Record<string, number>;
    soloEnd: Record<string, number>;
    knowledgeCoverageStart: Record<string, { factual: boolean; conceptual: boolean; procedural: boolean; metacognitive: boolean }>;
    knowledgeCoverageEnd: Record<string, { factual: boolean; conceptual: boolean; procedural: boolean; metacognitive: boolean }>;
    assessmentCount: number;
    calibrationScore: number;
    plateauDetected: boolean;
    notes: string;
    recommendedNext: string;
    blindSpots: string[];
  };
  assessments: {
    id: string;
    layerId: string;
    type: string;
    prompt: string;
    userResponse: string;
    observedSoloLevel: number;
    aiEvaluation: string;
    confidencePrediction: number;
    diagnosis: {
      knowledgeTypesDemonstrated: number[];
      connectionsMade: number;
      isMultistructuralPlateau: boolean;
      responsePattern: string;
      metacognitiveCalibration: string;
      specificGaps: string[];
    };
    passed: boolean;
  }[];
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SessionReview | null>(null);
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then(r => r.json())
      .then(setData);
  }, [id]);

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-stone-400">Loading review...</p>
      </div>
    );
  }

  const { session, assessments } = data;
  const duration = session.endTime
    ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <div>
        <a href="/" className="text-xs text-stone-400 hover:text-stone-600 transition-colors">&larr; Dashboard</a>
        <h1 className="text-2xl font-semibold text-stone-900 mt-2">Session Review</h1>
        <p className="text-sm text-stone-500 mt-1">
          {new Date(session.startTime).toLocaleDateString()} — {duration} min — {session.assessmentCount} assessments
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white border border-stone-200 rounded-lg p-5">
        <h2 className="font-medium text-stone-900 mb-3">Summary</h2>
        <p className="text-sm text-stone-600 leading-relaxed">{session.notes}</p>
      </div>

      {/* ZPD Diff */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-medium text-stone-900">SOLO Level Changes</h2>
        </div>
        <div className="p-5 space-y-4">
          {session.targetLayers.map(layerId => {
            const start = session.soloStart[layerId] ?? 0;
            const end = session.soloEnd?.[layerId] ?? start;
            const moved = end !== start;
            const covStart = session.knowledgeCoverageStart?.[layerId];
            const covEnd = session.knowledgeCoverageEnd?.[layerId];

            return (
              <div key={layerId} className="flex items-center gap-4">
                <span className="text-sm font-medium text-stone-700 w-48">{layerId}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: SOLO_COLORS[start as SoloLevel] }}
                  >
                    {SOLO_LABELS[start as SoloLevel]}
                  </span>
                  <span className="text-stone-300">&rarr;</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full text-white ${moved ? 'ring-2 ring-offset-1 ring-green-300' : ''}`}
                    style={{ backgroundColor: SOLO_COLORS[end as SoloLevel] }}
                  >
                    {SOLO_LABELS[end as SoloLevel]}
                  </span>
                </div>
                {covStart && covEnd && (
                  <div className="flex gap-3 text-xs ml-4">
                    {(['factual', 'conceptual', 'procedural', 'metacognitive'] as const).map(key => {
                      const was = covStart[key];
                      const now = covEnd[key];
                      const gained = !was && now;
                      return (
                        <span key={key} className={gained ? 'text-green-600 font-bold' : now ? 'text-stone-500' : 'text-stone-300'}>
                          {key[0].toUpperCase()}{gained ? '+' : ''}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calibration + Plateau */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Calibration</h3>
          <div className="text-3xl font-light text-stone-800">
            {session.calibrationScore.toFixed(1)}
          </div>
          <p className="text-xs text-stone-400 mt-1">Average prediction-performance gap</p>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Plateau Analysis</h3>
          {session.plateauDetected ? (
            <div className="text-sm text-amber-700">
              Multistructural plateau was detected. Responses showed listing without connecting.
            </div>
          ) : (
            <div className="text-sm text-green-700">
              No plateau detected. Responses showed appropriate structural quality.
            </div>
          )}
        </div>
      </div>

      {/* Blind Spots */}
      {session.blindSpots.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-500 mb-3">Detected Blind Spots</h3>
          <ul className="space-y-1">
            {session.blindSpots.map((spot, i) => (
              <li key={i} className="text-sm text-stone-600 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                {spot}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      {session.recommendedNext && (
        <div className="bg-stone-900 text-white rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-300 mb-2">Recommended Next</h3>
          <p className="text-sm leading-relaxed">{session.recommendedNext}</p>
        </div>
      )}

      {/* Assessment Log */}
      {assessments.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="font-medium text-stone-900">Assessment Log</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {assessments.map(a => (
              <div key={a.id} className="px-5 py-3">
                <button
                  onClick={() => setExpandedAssessment(expandedAssessment === a.id ? null : a.id)}
                  className="w-full text-left flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: SOLO_COLORS[(a.observedSoloLevel ?? 0) as SoloLevel] }}
                    >
                      {SOLO_LABELS[(a.observedSoloLevel ?? 0) as SoloLevel]}
                    </span>
                    <span className="text-xs text-stone-400">{a.type}</span>
                    <span className={`text-xs ${a.passed ? 'text-green-600' : 'text-red-500'}`}>
                      {a.passed ? 'passed' : 'not passed'}
                    </span>
                  </div>
                  <span className="text-xs text-stone-300">{expandedAssessment === a.id ? '−' : '+'}</span>
                </button>

                {expandedAssessment === a.id && (
                  <div className="mt-3 space-y-2 text-sm">
                    {a.aiEvaluation && (
                      <div>
                        <span className="text-xs font-medium text-stone-500">Evidence: </span>
                        <span className="text-stone-600">{a.aiEvaluation}</span>
                      </div>
                    )}
                    {a.diagnosis?.specificGaps?.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-stone-500">Gaps: </span>
                        <span className="text-stone-600">{a.diagnosis.specificGaps.join(', ')}</span>
                      </div>
                    )}
                    {a.diagnosis?.responsePattern && (
                      <div>
                        <span className="text-xs font-medium text-stone-500">Pattern: </span>
                        <span className="text-stone-600">{a.diagnosis.responsePattern}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
