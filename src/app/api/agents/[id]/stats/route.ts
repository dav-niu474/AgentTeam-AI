import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/agents/[id]/stats - Get agent performance statistics
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    // Verify agent exists
    const agent = await db.member.findUnique({
      where: { id, type: 'agent' },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 },
      );
    }

    // Get issues assigned to this agent
    const assignedIssues = await db.issue.findMany({
      where: { assigneeId: id },
      select: {
        id: true,
        status: true,
        priority: true,
        scene: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate performance metrics
    const totalAssigned = assignedIssues.length;
    const resolved = assignedIssues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;
    const inProgress = assignedIssues.filter((i) => i.status === 'in_progress').length;
    const inReview = assignedIssues.filter((i) => i.status === 'in_review').length;
    const open = assignedIssues.filter((i) => i.status === 'open' || i.status === 'triaged').length;

    const completionRate = totalAssigned > 0 ? Math.round((resolved / totalAssigned) * 100) : 0;

    // Calculate average resolution time (from creation to resolution for resolved issues)
    const resolvedIssues = assignedIssues.filter(
      (i) => i.status === 'resolved' || i.status === 'closed',
    );
    let avgResolutionHours = 0;
    if (resolvedIssues.length > 0) {
      const totalHours = resolvedIssues.reduce((sum, issue) => {
        const created = new Date(issue.createdAt).getTime();
        const updated = new Date(issue.updatedAt).getTime();
        return sum + (updated - created) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedIssues.length) * 10) / 10;
    }

    // Scene distribution
    const sceneCounts: Record<string, number> = {};
    assignedIssues.forEach((issue) => {
      const scene = issue.scene || 'other';
      sceneCounts[scene] = (sceneCounts[scene] || 0) + 1;
    });

    // Priority distribution
    const priorityCounts: Record<string, number> = {};
    assignedIssues.forEach((issue) => {
      const priority = issue.priority || 'medium';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentLogs = await db.auditLog.findMany({
      where: {
        actorId: id,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, action: true },
      orderBy: { createdAt: 'desc' },
    });

    // Activity by day (last 30 days)
    const activityByDay: Record<string, number> = {};
    recentLogs.forEach((log) => {
      const day = new Date(log.createdAt).toISOString().split('T')[0];
      activityByDay[day] = (activityByDay[day] || 0) + 1;
    });

    return NextResponse.json({
      agentId: id,
      totalAssigned,
      statusBreakdown: {
        open,
        inProgress,
        inReview,
        resolved,
      },
      completionRate,
      avgResolutionHours,
      sceneDistribution: sceneCounts,
      priorityDistribution: priorityCounts,
      activityByDay,
      recentActivityCount: recentLogs.length,
    });
  } catch (error) {
    console.error('Failed to get agent stats:', error);
    return NextResponse.json(
      { error: 'Failed to get agent stats' },
      { status: 500 },
    );
  }
}
