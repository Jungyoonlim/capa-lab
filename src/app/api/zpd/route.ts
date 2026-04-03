import { NextResponse } from 'next/server';
import { getAllZPDStates, getAllLayers } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

export async function GET() {
  seedDatabase();
  const layers = getAllLayers();
  const zpdStates = getAllZPDStates();
  return NextResponse.json({ layers, zpdStates });
}
