import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Valid status transitions state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['triaged', 'closed'],
  triaged: ['in_progress', 'closed'],
  in_progress: ['in_review', 'open'],
  in_review: ['resolved', 'in_progress'],
  resolved: ['closed', 'in_progress'],
  closed: ['open'],
};

// PATCH /api/issues/[id]/status - Change issue status with state machine validation
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;
    const body = await request.json();
    const { status: newStatus, actorId } = body;

    if (!newStatus) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const issue = await db.issue.findUnique({ where: { id } });
    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    const currentStatus = issue.status;
    const allowedTransitions = VALID_TRANSITIONS[currentStatus];

    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from "${currentStatus}" to "${newStatus}"`,
          currentStatus,
          allowedTransitions: allowedTransitions || [],
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    // Set resolvedAt when transitioning to resolved
    if (newStatus === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    // Clear resolvedAt when reopening from resolved
    if (currentStatus === 'resolved' && newStatus === 'in_progress') {
      updateData.resolvedAt = null;
    }

    const updatedIssue = await db.issue.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        assignee: {
          select: { id: true, name: true, type: true, avatar: true },
        },
      },
    });

    // Create audit log
    const logActorId = actorId || issue.creatorId;
    const actor = await db.member.findUnique({ where: { id: logActorId } });
    await createAuditLog({
      actorId: logActorId,
      actorType: (actor?.type || 'system') as 'human' | 'agent' | 'system',
      action: 'change_status',
      targetType: 'issue',
      targetId: id,
      details: {
        from: currentStatus,
        to: newStatus,
      },
    });

    // Broadcast real-time event
    broadcastEvent('issue:status', { issueId: id, from: currentStatus, to: newStatus, actorId: logActorId });

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error('Failed to change issue status:', error);
    return NextResponse.json(
      { error: 'Failed to change issue status' },
      { status: 500 }
    );
  }
}
