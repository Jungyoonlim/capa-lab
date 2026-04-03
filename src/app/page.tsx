'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SoloLevel, SOLO_LABELS, SOLO_COLORS, KnowledgeType } from '@/lib/types';

interface DashboardData {
  layers: { id: string; name: string; description: string; order: number; domain?: string }[];
  zpdStates: Record<string, {
    layerId: string;
    soloLevel: number;
    soloConfidence: number;
    knowledgeCoverage: { factual: boolean; conceptual: boolean; procedural: boolean; metacognitive: boolean };
    calibration: { calibrationGap: number; trend: string };
    multistructuralPlateau: boolean;
    plateauSessionCount: number;
  }>;
  sessions: { id: string; startTime: string; endTime: string | null; targetLayers: string[]; notes: string; assessmentCount: number }[];
  combinations: { layers: string[]; unlocked: boolean; requiredSoloLevel: number }[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const startSession = async () => {
    if (selectedLayers.length === 0) return;
    setStarting(true);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLayers: selectedLayers }),
    });
    const { session } = await res.json();
    router.push(`/session/${session.id}`);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  if (!data) return null;

  const soloLevels = [0, 1, 2, 3, 4] as SoloLevel[];
  const hasPlateauAlert = Object.values(data.zpdStates).some(s => s.multistructuralPlateau);

  const calibrationValues = Object.values(data.zpdStates)
    .filter(s => s.calibration.calibrationGap !== 0)
    .map(s => s.calibration.calibrationGap);
  const avgCalibration = calibrationValues.length > 0
    ? calibrationValues.reduce((a, b) => a + b, 0) / calibrationValues.length
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-stone-900">ZPD Dashboard</h1>
          <p className="text-lg text-stone-500 mt-1">
            {[...new Set(data.layers.map(l => l.domain || 'unknown'))].join(', ')}
          </p>
        </div>
        <a
          href="/curriculum"
          className="px-4 py-2 text-base font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
        >
          Manage Curriculum
        </a>
      </div>

      {hasPlateauAlert && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg px-5 py-4 text-base text-amber-800">
          <span className="font-medium">Multistructural Plateau Detected</span> — One or more layers show listing without connecting. Focus on relational exercises.
        </div>
      )}

      {/* ZPD Matrix */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-xl font-medium text-stone-900">ZPD Matrix</h2>
          <p className="text-sm text-stone-400 mt-1">SOLO level per layer with knowledge type coverage</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-6 py-4 font-medium text-stone-500 w-72">Layer</th>
                {soloLevels.map(level => (
                  <th key={level} className="px-5 py-4 font-medium text-stone-500 text-center w-36">
                    <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: SOLO_COLORS[level] }} />
                    {SOLO_LABELS[level]}
                  </th>
                ))}
                <th className="px-5 py-4 font-medium text-stone-500 text-center w-36">Coverage</th>
                <th className="px-5 py-4 font-medium text-stone-500 text-center w-24">Cal.</th>
              </tr>
            </thead>
            <tbody>
              {data.layers.map(layer => {
                const state = data.zpdStates[layer.id];
                if (!state) return null;
                const coverage = state.knowledgeCoverage;
                const coverageArr = [
                  { key: KnowledgeType.Factual, label: 'F', value: coverage.factual },
                  { key: KnowledgeType.Conceptual, label: 'C', value: coverage.conceptual },
                  { key: KnowledgeType.Procedural, label: 'P', value: coverage.procedural },
                  { key: KnowledgeType.Metacognitive, label: 'M', value: coverage.metacognitive },
                ];
                const calGap = state.calibration.calibrationGap;
                const calLabel = calGap > 1 ? 'Over' : calGap < -1 ? 'Under' : 'OK';
                const calColor = calGap > 1 ? 'text-red-500' : calGap < -1 ? 'text-blue-500' : 'text-green-600';

                return (
                  <tr key={layer.id} className="border-b border-stone-50 hover:bg-stone-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedLayers.includes(layer.id)}
                          onChange={(e) => {
                            setSelectedLayers(prev =>
                              e.target.checked ? [...prev, layer.id] : prev.filter(id => id !== layer.id)
                            );
                          }}
                          className="rounded border-stone-300 w-5 h-5"
                        />
                        <div>
                          <div className="font-medium text-stone-800 text-lg">{layer.name}</div>
                          {state.multistructuralPlateau && (
                            <span className="text-sm text-amber-600">plateau detected</span>
                          )}
                        </div>
                      </div>
                    </td>
                    {soloLevels.map(level => {
                      const isCurrentLevel = state.soloLevel === level;
                      const isPast = level < state.soloLevel;
                      return (
                        <td key={level} className="px-5 py-4 text-center">
                          {isCurrentLevel ? (
                            <div
                              className="inline-flex items-center justify-center w-12 h-12 rounded-full text-white text-sm font-bold"
                              style={{
                                backgroundColor: SOLO_COLORS[level as SoloLevel],
                                opacity: 0.4 + state.soloConfidence * 0.6,
                              }}
                            >
                              {Math.round(state.soloConfidence * 100)}
                            </div>
                          ) : isPast ? (
                            <div
                              className="inline-block w-4 h-4 rounded-full opacity-30"
                              style={{ backgroundColor: SOLO_COLORS[level as SoloLevel] }}
                            />
                          ) : (
                            <div className="inline-block w-4 h-4 rounded-full bg-stone-200" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2.5">
                        {coverageArr.map(c => (
                          <span
                            key={c.key}
                            className={`text-base font-mono ${c.value ? 'text-green-600 font-bold' : 'text-stone-300'}`}
                            title={`${c.label}: ${c.value ? 'covered' : 'gap'}`}
                          >
                            {c.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={`px-5 py-4 text-center text-base font-medium ${calColor}`}>
                      {calLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Calibration */}
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-base font-medium text-stone-500 mb-3">Metacognitive Calibration</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(0, 50 + avgCalibration * 25))}%`,
                    backgroundColor: Math.abs(avgCalibration) < 0.5 ? '#22c55e' : Math.abs(avgCalibration) < 1 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-stone-400 mt-1">
                <span>Under</span>
                <span>Calibrated</span>
                <span>Over</span>
              </div>
            </div>
            <span className="text-3xl font-light text-stone-800">
              {avgCalibration > 0 ? '+' : ''}{avgCalibration.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Combination Map */}
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-base font-medium text-stone-500 mb-3">Layer Combinations</h3>
          <div className="space-y-2">
            {data.combinations
              .filter(c => c.layers.length === 2)
              .slice(0, 5)
              .map((combo, i) => (
                <div key={i} className="flex items-center gap-2 text-base">
                  <span className={`w-2 h-2 rounded-full ${combo.unlocked ? 'bg-green-500' : 'bg-stone-300'}`} />
                  <span className={combo.unlocked ? 'text-stone-700' : 'text-stone-400'}>
                    {combo.layers.map(id => {
                      const layer = data.layers.find(l => l.id === id);
                      return layer?.name.split(' ')[0];
                    }).join(' + ')}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Start Session */}
        <div className="bg-white border border-stone-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-medium text-stone-500 mb-2">Start Session</h3>
            <p className="text-base text-stone-400">
              {selectedLayers.length === 0
                ? 'Select layers from the matrix above'
                : `${selectedLayers.length} layer${selectedLayers.length > 1 ? 's' : ''} selected`}
            </p>
          </div>
          <button
            onClick={startSession}
            disabled={selectedLayers.length === 0 || starting}
            className="mt-4 w-full py-3 bg-stone-900 text-white text-base font-medium rounded-lg hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {starting ? 'Starting...' : 'Begin Session'}
          </button>
        </div>
      </div>

      {/* Recent Sessions */}
      {data.sessions.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h2 className="text-xl font-medium text-stone-900">Recent Sessions</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {data.sessions.map(session => (
              <a
                key={session.id}
                href={session.endTime ? `/session/${session.id}/review` : `/session/${session.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-stone-50 transition-colors"
              >
                <div>
                  <div className="text-base text-stone-800">
                    {session.targetLayers.join(', ')}
                  </div>
                  <div className="text-sm text-stone-400">
                    {new Date(session.startTime).toLocaleDateString()} — {session.assessmentCount} assessments
                  </div>
                </div>
                <div className="text-sm text-stone-400">
                  {session.endTime ? 'Completed' : 'In Progress'}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
