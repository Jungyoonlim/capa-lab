import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';

export async function POST() {
  const seeded = seedDatabase();
  return NextResponse.json({ seeded });
}
