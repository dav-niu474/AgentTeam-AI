import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/issues/[id] - Get issue with creator, assignee, comments, sessions populated
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    const issue = await db.issue.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true, agentStatus: true },
        },
        assignee: {
          select: { id: true, name: true, type: true, avatar: true, agentStatus: true },
        },
        inspiration: {
          select: { id: true, content: true, status: true },
        },
        parentIssue: {
          select: { id: true, title: true, status: true },
        },
        childIssues: {
          select: { id: true, title: true, status: true, priority: true },
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          include: {
            author: {
              select: { id: true, name: true, type: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        sessions: {
          include: {
            agent: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        auditLogs: {
          include: {
            actor: {
              select: { id: true, name: true, type: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Failed to get issue:', error);
    return NextResponse.json(
      { error: 'Failed to get issue' },
      { status: 500 }
    );
  }
}

// PATCH /api/issues/[id] - Update issue
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;
    const body = await request.json();
    const {
      title,
      description,
      priority,
      scene,
      labels,
      assigneeId,
      inspirationId,
    } = body;

    const existing = await db.issue.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (scene !== undefined) updateData.scene = scene;
    if (labels !== undefined) updateData.labels = JSON.stringify(labels);
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (inspirationId !== undefined) updateData.inspirationId = inspirationId;

    const issue = await db.issue.update({
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

    // Create audit log for reassignment
    if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
      const actorId = body.actorId || existing.creatorId;
      const actor = await db.member.findUnique({ where: { id: actorId } });
      await createAuditLog({
        actorId,
        actorType: (actor?.type || 'system') as 'human' | 'agent' | 'system',
        action: 'reassign_issue',
        targetType: 'issue',
        targetId: id,
        details: {
          from: existing.assigneeId,
          to: assigneeId,
        },
      });
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Failed to update issue:', error);
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    );
  }
}

// DELETE /api/issues/[id] - Delete issue (cascades related records)
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    const existing = await db.issue.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    // Create audit log before deletion (since audit logs reference the issue)
    const actorId = existing.creatorId;
    const actor = await db.member.findUnique({ where: { id: actorId } });
    await createAuditLog({
      actorId,
      actorType: (actor?.type || 'system') as 'human' | 'agent' | 'system',
      action: 'delete_issue',
      targetType: 'issue',
      targetId: id,
      details: { title: existing.title },
    });

    // Delete related records in correct order to avoid foreign key violations
    // 1. Delete audit logs that reference this issue
    await db.auditLog.deleteMany({ where: { targetId: id, targetType: 'issue' } });
    // 2. Delete sessions for this issue
    await db.session.deleteMany({ where: { issueId: id } });
    // 3. Delete comments for this issue
    await db.comment.deleteMany({ where: { issueId: id } });
    // 4. Unlink child issues (set parentIssueId to null)
    await db.issue.updateMany({
      where: { parentIssueId: id },
      data: { parentIssueId: null },
    });
    // 5. Delete the issue itself
    await db.issue.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete issue:', error);
    return NextResponse.json(
      { error: 'Failed to delete issue' },
      { status: 500 }
    );
  }
}
