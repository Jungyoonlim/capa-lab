'use client';

import { useEffect, useState } from 'react';
import { SOLO_LABELS, SOLO_COLORS, SoloLevel } from '@/lib/types';

interface SessionSummary {
  id: string;
  startTime: string;
  endTime: string | null;
  targetLayers: string[];
  soloStart: Record<string, number>;
  soloEnd: Record<string, number>;
  assessmentCount: number;
  calibrationScore: number;
  plateauDetected: boolean;
  notes: string;
  recommendedNext: string;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLayer, setFilterLayer] = useState<string>('all');
  const [layers, setLayers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions').then(r => r.json()),
      fetch('/api/zpd').then(r => r.json()),
    ]).then(([sessionsData, zpdData]) => {
      setSessions(sessionsData.sessions || []);
      setLayers(zpdData.layers || []);
      setLoading(false);
    });
  }, []);

  const filtered = filterLayer === 'all'
    ? sessions
    : sessions.filter(s => s.targetLayers.includes(filterLayer));

  const totalAssessments = sessions.reduce((sum, s) => sum + s.assessmentCount, 0);
  const avgCalibration = sessions.length > 0
    ? sessions.reduce((sum, s) => sum + s.calibrationScore, 0) / sessions.length
    : 0;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-stone-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Session History</h1>
        <p className="text-sm text-stone-500 mt-1">
          {sessions.length} sessions — {totalAssessments} total assessments
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-500">Total Sessions</h3>
          <p className="text-3xl font-light text-stone-800 mt-1">{sessions.length}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-500">Total Assessments</h3>
          <p className="text-3xl font-light text-stone-800 mt-1">{totalAssessments}</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-5">
          <h3 className="text-sm font-medium text-stone-500">Avg Calibration Gap</h3>
          <p className="text-3xl font-light text-stone-800 mt-1">{avgCalibration.toFixed(1)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-500">Filter:</span>
        <select
          value={filterLayer}
          onChange={e => setFilterLayer(e.target.value)}
          className="border border-stone-200 rounded-md px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:border-stone-400"
        >
          <option value="all">All layers</option>
          {layers.map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Session List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-stone-400">No sessions yet. Start one from the dashboard.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="divide-y divide-stone-50">
            {filtered.map(session => {
              const duration = session.endTime
                ? Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
                : null;

              return (
                <a
                  key={session.id}
                  href={session.endTime ? `/session/${session.id}/review` : `/session/${session.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-stone-800">
                        {session.targetLayers.map(id => {
                          const layer = layers.find(l => l.id === id);
                          return layer?.name || id;
                        }).join(', ')}
                      </span>
                      {session.plateauDetected && (
                        <span className="text-xs text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">plateau</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-400">
                      {new Date(session.startTime).toLocaleDateString()} — {session.assessmentCount} assessments
                      {duration !== null && ` — ${duration} min`}
                    </div>
                    {/* SOLO progression */}
                    <div className="flex gap-3">
                      {session.targetLayers.map(layerId => {
                        const start = session.soloStart?.[layerId] ?? 0;
                        const end = session.soloEnd?.[layerId] ?? start;
                        return (
                          <div key={layerId} className="flex items-center gap-1 text-xs">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: SOLO_COLORS[start as SoloLevel] }}
                            />
                            <span className="text-stone-300">&rarr;</span>
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: SOLO_COLORS[end as SoloLevel] }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-xs text-stone-400">
                    {session.endTime ? 'Completed' : 'In Progress'}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
