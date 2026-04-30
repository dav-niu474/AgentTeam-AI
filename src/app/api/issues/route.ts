import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

// GET /api/issues - List issues with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assigneeId = searchParams.get('assigneeId');
    const creatorId = searchParams.get('creatorId');
    const priority = searchParams.get('priority');
    const scene = searchParams.get('scene');
    const inspirationId = searchParams.get('inspirationId');
    const parentIssueId = searchParams.get('parentIssueId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (creatorId) where.creatorId = creatorId;
    if (priority) where.priority = priority;
    if (scene) where.scene = scene;
    if (inspirationId) where.inspirationId = inspirationId;
    if (parentIssueId) where.parentIssueId = parentIssueId;

    const issues = await db.issue.findMany({
      where,
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
        _count: {
          select: { comments: true, childIssues: true, sessions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(issues);
  } catch (error) {
    console.error('Failed to list issues:', error);
    return NextResponse.json(
      { error: 'Failed to list issues' },
      { status: 500 }
    );
  }
}

// POST /api/issues - Create issue (both human-created and agent-created)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      priority = 'medium',
      scene,
      labels,
      creatorId,
      assigneeId,
      inspirationId,
      parentIssueId,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    // Validate creator exists
    const creator = await db.member.findUnique({ where: { id: creatorId } });
    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 400 }
      );
    }

    // Validate assignee if provided
    if (assigneeId) {
      const assignee = await db.member.findUnique({ where: { id: assigneeId } });
      if (!assignee) {
        return NextResponse.json(
          { error: 'Assignee not found' },
          { status: 400 }
        );
      }
    }

    const issue = await db.issue.create({
      data: {
        title,
        description,
        priority,
        scene,
        labels: labels ? JSON.stringify(labels) : null,
        creatorId,
        assigneeId: assigneeId || null,
        inspirationId: inspirationId || null,
        parentIssueId: parentIssueId || null,
      },
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        assignee: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        inspiration: {
          select: { id: true, content: true, status: true },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: creatorId,
      actorType: creator.type as 'human' | 'agent',
      action: 'create_issue',
      targetType: 'issue',
      targetId: issue.id,
      details: { title, priority, scene, assigneeId },
    });

    // Broadcast real-time event
    await broadcastEvent('issue:created', { issueId: issue.id, title: issue.title, creatorId, assigneeId });

    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error('Failed to create issue:', error);
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    );
  }
}
