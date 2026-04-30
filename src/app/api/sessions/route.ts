import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/sessions - List sessions, filter by ?agentId=xxx&issueId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const issueId = searchParams.get('issueId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;
    if (issueId) where.issueId = issueId;
    if (status) where.status = status;

    const sessions = await db.session.findMany({
      where,
      include: {
        agent: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issue: {
          select: { id: true, title: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create or resume session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, issueId, workingDir, gitBranch, context, status = 'active' } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    if (!issueId) {
      return NextResponse.json(
        { error: 'Issue ID is required' },
        { status: 400 }
      );
    }

    // Check if session already exists for (agentId, issueId) - resume it
    const existingSession = await db.session.findUnique({
      where: {
        agentId_issueId: { agentId, issueId },
      },
    });

    if (existingSession) {
      // Resume: update the existing session
      const resumedSession = await db.session.update({
        where: { id: existingSession.id },
        data: {
          status: status || 'active',
          workingDir: workingDir || existingSession.workingDir,
          gitBranch: gitBranch || existingSession.gitBranch,
          context: context ? JSON.stringify(context) : existingSession.context,
        },
        include: {
          agent: {
            select: { id: true, name: true, type: true, avatar: true },
          },
          issue: {
            select: { id: true, title: true, status: true },
          },
        },
      });

      return NextResponse.json(resumedSession);
    }

    // Create new session
    const session = await db.session.create({
      data: {
        agentId,
        issueId,
        status,
        messages: '[]',
        workingDir,
        gitBranch,
        context: context ? JSON.stringify(context) : null,
      },
      include: {
        agent: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issue: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Failed to create/resume session:', error);
    return NextResponse.json(
      { error: 'Failed to create/resume session' },
      { status: 500 }
    );
  }
}
