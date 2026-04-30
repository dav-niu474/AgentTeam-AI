import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

// GET /api/comments - List comments for an issue: ?issueId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const issueId = searchParams.get('issueId');

    if (!issueId) {
      return NextResponse.json(
        { error: 'issueId query parameter is required' },
        { status: 400 }
      );
    }

    const comments = await db.comment.findMany({
      where: { issueId },
      include: {
        author: {
          select: { id: true, name: true, type: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Failed to list comments:', error);
    return NextResponse.json(
      { error: 'Failed to list comments' },
      { status: 500 }
    );
  }
}

// POST /api/comments - Add comment (human or agent)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, authorId, issueId, authorType = 'human', metadata } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!authorId) {
      return NextResponse.json(
        { error: 'Author ID is required' },
        { status: 400 }
      );
    }

    if (!issueId) {
      return NextResponse.json(
        { error: 'Issue ID is required' },
        { status: 400 }
      );
    }

    // Validate issue exists
    const issue = await db.issue.findUnique({ where: { id: issueId } });
    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    // Validate author exists
    const author = await db.member.findUnique({ where: { id: authorId } });
    if (!author) {
      return NextResponse.json(
        { error: 'Author not found' },
        { status: 404 }
      );
    }

    const comment = await db.comment.create({
      data: {
        content,
        authorId,
        issueId,
        authorType,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        author: {
          select: { id: true, name: true, type: true, avatar: true },
        },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId,
      actorType: authorType as 'human' | 'agent' | 'system',
      action: 'add_comment',
      targetType: 'comment',
      targetId: comment.id,
      details: { issueId },
    });

    // Broadcast real-time event
    await broadcastEvent('comment:added', { commentId: comment.id, issueId, authorId, authorType });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
