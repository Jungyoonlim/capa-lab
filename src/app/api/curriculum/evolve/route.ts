import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/seed';
import { analyzeCurriculumEvolution } from '@/lib/engine/curriculum';

export async function GET(request: NextRequest) {
  seedDatabase();

  const domain = request.nextUrl.searchParams.get('domain');
  if (!domain) {
    return NextResponse.json({ error: 'domain query parameter is required' }, { status: 400 });
  }

  try {
    const result = await analyzeCurriculumEvolution(domain);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze curriculum';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
