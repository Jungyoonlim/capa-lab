import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAssessmentsBySession, getChatMessages } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  seedDatabase();
  const { id } = await params;

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const assessments = getAssessmentsBySession(id);
  const messages = getChatMessages(id);

  return NextResponse.json({ session, assessments, messages });
}
