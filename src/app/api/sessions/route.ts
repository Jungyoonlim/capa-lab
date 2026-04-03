import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { createSession, getAllZPDStates, getAllSessions } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { ZPDState } from '@/lib/types';

export async function GET() {
  seedDatabase();
  const sessions = getAllSessions();
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  seedDatabase();

  const body = await request.json();
  const { targetLayers } = body as { targetLayers: string[] };

  if (!targetLayers || targetLayers.length === 0) {
    return NextResponse.json({ error: 'targetLayers required' }, { status: 400 });
  }

  const zpdStatesArr = getAllZPDStates();
  const soloStart: Record<string, number> = {};
  const knowledgeCoverageStart: Record<string, object> = {};

  for (const state of zpdStatesArr) {
    if (targetLayers.includes(state.layerId)) {
      soloStart[state.layerId] = state.soloLevel;
      knowledgeCoverageStart[state.layerId] = (state as unknown as ZPDState).knowledgeCoverage;
    }
  }

  const session = {
    id: uuid(),
    startTime: new Date().toISOString(),
    targetLayers,
    soloStart,
    knowledgeCoverageStart,
  };

  createSession(session);

  return NextResponse.json({ session: { ...session, assessmentCount: 0, notes: '', recommendedNext: '', blindSpots: [] } });
}
