import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/sessions/[id] - Get session with full message history
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    const session = await db.session.findUnique({
      where: { id },
      include: {
        agent: {
          select: { id: true, name: true, type: true, avatar: true, capabilities: true },
        },
        issue: {
          select: { id: true, title: true, description: true, status: true, priority: true, scene: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Parse the messages JSON string
    const parsedSession = {
      ...session,
      messages: JSON.parse(session.messages || '[]'),
      context: session.context ? JSON.parse(session.context) : null,
    };

    return NextResponse.json(parsedSession);
  } catch (error) {
    console.error('Failed to get session:', error);
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] - Update session (add messages, update working dir, etc.)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;
    const body = await request.json();
    const { messages, workingDir, gitBranch, context: sessionContext, status } = body;

    const existing = await db.session.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (messages !== undefined) updateData.messages = JSON.stringify(messages);
    if (workingDir !== undefined) updateData.workingDir = workingDir;
    if (gitBranch !== undefined) updateData.gitBranch = gitBranch;
    if (sessionContext !== undefined) updateData.context = JSON.stringify(sessionContext);
    if (status !== undefined) updateData.status = status;

    const session = await db.session.update({
      where: { id },
      data: updateData,
      include: {
        agent: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issue: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Failed to update session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
