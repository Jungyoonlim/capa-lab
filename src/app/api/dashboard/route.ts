import { NextResponse } from 'next/server';
import { getAllLayers, getAllZPDStates, getAllSessions } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { getAvailableCombinations } from '@/lib/engine/gating';
import { ZPDState } from '@/lib/types';

export async function GET() {
  seedDatabase();

  const layers = getAllLayers();
  const zpdStatesArr = getAllZPDStates();
  const sessions = getAllSessions();

  const zpdStates: Record<string, ZPDState> = {};
  for (const state of zpdStatesArr) {
    zpdStates[state.layerId] = state as unknown as ZPDState;
  }

  const layerIds = (layers as { id: string }[]).map(l => l.id);
  const combinations = getAvailableCombinations(layerIds, zpdStates);

  return NextResponse.json({
    layers,
    zpdStates,
    sessions: sessions.slice(0, 10),
    combinations,
  });
}
