import { NextRequest, NextResponse } from 'next/server';
import { generateCurriculum } from '@/lib/engine/curriculum';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { topic } = body as { topic: string };

  if (!topic || topic.trim().length === 0) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  try {
    const curriculum = await generateCurriculum(topic.trim());
    return NextResponse.json({ curriculum });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate curriculum';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
