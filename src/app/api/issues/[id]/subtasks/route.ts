import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/issues/[id]/subtasks - List subtasks of an issue
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;

    const subtasks = await db.issue.findMany({
      where: { parentIssueId: id },
      include: {
        creator: { select: { id: true, name: true, type: true, avatar: true } },
        assignee: { select: { id: true, name: true, type: true, avatar: true, agentStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: subtasks });
  } catch (error) {
    console.error('Failed to list subtasks:', error);
    return NextResponse.json(
      { error: 'Failed to list subtasks' },
      { status: 500 },
    );
  }
}

// POST /api/issues/[id]/subtasks - Create a subtask
export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Verify parent issue exists
    const parent = await db.issue.findUnique({ where: { id } });
    if (!parent) {
      return NextResponse.json(
        { error: 'Parent issue not found' },
        { status: 404 },
      );
    }

    const {
      title,
      description,
      priority = 'medium',
      scene,
      assigneeId,
      creatorId,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 },
      );
    }

    const subtask = await db.issue.create({
      data: {
        title: title.trim(),
        description: description || '',
        priority,
        scene: scene || parent.scene,
        status: 'open',
        parentIssueId: id,
        creatorId: creatorId || parent.creatorId,
        assigneeId: assigneeId || parent.assigneeId,
      },
      include: {
        creator: { select: { id: true, name: true, type: true, avatar: true } },
        assignee: { select: { id: true, name: true, type: true, avatar: true, agentStatus: true } },
      },
    });

    // Audit log
    createAuditLog({
      actorId: creatorId || 'system',
      actorType: creatorId ? 'human' : 'system',
      action: 'create_subtask',
      targetType: 'issue',
      targetId: subtask.id,
      details: JSON.stringify({ parentId: id, title: title.trim() }),
    });

    // Real-time event
    broadcastEvent('issue:created', { issue: subtask });

    return NextResponse.json(subtask, { status: 201 });
  } catch (error) {
    console.error('Failed to create subtask:', error);
    return NextResponse.json(
      { error: 'Failed to create subtask' },
      { status: 500 },
    );
  }
}
