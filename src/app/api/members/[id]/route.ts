import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/members/[id] - Get member by ID
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const member = await db.member.findUnique({
      where: { id },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
        createdIssues: {
          select: { id: true, title: true, status: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        assignedIssues: {
          select: { id: true, title: true, status: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error('Failed to get member:', error);
    return NextResponse.json(
      { error: 'Failed to get member' },
      { status: 500 }
    );
  }
}

// PATCH /api/members/[id] - Update member
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const existing = await db.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    const {
      name,
      avatar,
      email,
      // Human fields
      role,
      // Agent fields
      capabilities,
      agentGroup,
      daemonId,
      agentStatus,
      description,
      systemPrompt,
      autopilot,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (email !== undefined) updateData.email = email;

    if (existing.type === 'human') {
      if (role !== undefined) updateData.role = role;
    }

    if (existing.type === 'agent') {
      if (capabilities !== undefined) updateData.capabilities = JSON.stringify(capabilities);
      if (agentGroup !== undefined) updateData.agentGroup = agentGroup;
      if (daemonId !== undefined) updateData.daemonId = daemonId;
      if (agentStatus !== undefined) updateData.agentStatus = agentStatus;
      if (description !== undefined) updateData.description = description;
      if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
      if (autopilot !== undefined) updateData.autopilot = autopilot;
    }

    const member = await db.member.update({
      where: { id },
      data: updateData,
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error('Failed to update member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

// DELETE /api/members/[id] - Remove member (cascades related records)
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const existing = await db.member.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Delete related records in correct order to avoid foreign key violations
    // 1. Delete agent skill bindings
    await db.agentSkill.deleteMany({ where: { agentId: id } });
    // 2. Delete sessions where this member is the agent
    await db.session.deleteMany({ where: { agentId: id } });
    // 3. Delete comments by this member
    await db.comment.deleteMany({ where: { authorId: id } });
    // 4. Delete audit logs by this member
    await db.auditLog.deleteMany({ where: { actorId: id } });
    // 5. Unassign from issues (set assigneeId to null)
    await db.issue.updateMany({
      where: { assigneeId: id },
      data: { assigneeId: null },
    });
    // 6. Delete inspirations created by this member (cascades issues)
    const memberInspirations = await db.inspiration.findMany({
      where: { creatorId: id },
      select: { id: true },
    });
    for (const insp of memberInspirations) {
      // Delete issues from these inspirations (with cascade)
      const inspIssues = await db.issue.findMany({
        where: { inspirationId: insp.id },
        select: { id: true },
      });
      for (const issue of inspIssues) {
        await db.auditLog.deleteMany({ where: { targetId: issue.id, targetType: 'issue' } });
        await db.session.deleteMany({ where: { issueId: issue.id } });
        await db.comment.deleteMany({ where: { issueId: issue.id } });
        await db.issue.updateMany({ where: { parentIssueId: issue.id }, data: { parentIssueId: null } });
        await db.issue.delete({ where: { id: issue.id } });
      }
      await db.inspiration.delete({ where: { id: insp.id } });
    }
    // 7. Delete issues created by this member (that weren't from inspirations)
    const memberIssues = await db.issue.findMany({
      where: { creatorId: id, inspirationId: null },
      select: { id: true },
    });
    for (const issue of memberIssues) {
      await db.auditLog.deleteMany({ where: { targetId: issue.id, targetType: 'issue' } });
      await db.session.deleteMany({ where: { issueId: issue.id } });
      await db.comment.deleteMany({ where: { issueId: issue.id } });
      await db.issue.updateMany({ where: { parentIssueId: issue.id }, data: { parentIssueId: null } });
      await db.issue.delete({ where: { id: issue.id } });
    }
    // 8. Delete the member
    await db.member.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  }
}
