import { NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

// GET /api/stats - Dashboard statistics
export async function GET() {
  try {
    // Ensure database is initialized (for Vercel serverless)
    await ensureDbInitialized();
    // Issue counts by status
    const [
      openCount,
      triagedCount,
      inProgressCount,
      inReviewCount,
      resolvedCount,
      closedCount,
      totalIssues,
    ] = await Promise.all([
      db.issue.count({ where: { status: 'open' } }),
      db.issue.count({ where: { status: 'triaged' } }),
      db.issue.count({ where: { status: 'in_progress' } }),
      db.issue.count({ where: { status: 'in_review' } }),
      db.issue.count({ where: { status: 'resolved' } }),
      db.issue.count({ where: { status: 'closed' } }),
      db.issue.count(),
    ]);

    // Agent status summary
    const [onlineAgents, busyAgents, offlineAgents, totalAgents] = await Promise.all([
      db.member.count({ where: { type: 'agent', agentStatus: 'online' } }),
      db.member.count({ where: { type: 'agent', agentStatus: 'busy' } }),
      db.member.count({ where: { type: 'agent', agentStatus: 'offline' } }),
      db.member.count({ where: { type: 'agent' } }),
    ]);

    // Human member count
    const totalHumans = await db.member.count({ where: { type: 'human' } });

    // Inspiration stats
    const [pendingInspirations, analyzingInspirations, convertedInspirations, dismissedInspirations, totalInspirations] = await Promise.all([
      db.inspiration.count({ where: { status: 'pending' } }),
      db.inspiration.count({ where: { status: 'analyzing' } }),
      db.inspiration.count({ where: { status: 'converted' } }),
      db.inspiration.count({ where: { status: 'dismissed' } }),
      db.inspiration.count(),
    ]);

    // Recent activity (last 10 audit logs)
    const recentActivity = await db.auditLog.findMany({
      include: {
        actor: {
          select: { id: true, name: true, type: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Active sessions count
    const activeSessions = await db.session.count({ where: { status: 'active' } });

    // Online daemons
    const onlineDaemons = await db.daemon.count({ where: { status: 'online' } });

    // Agent performance data - per agent stats
    const agentList = await db.member.findMany({
      where: { type: 'agent' },
      select: {
        id: true,
        name: true,
        agentStatus: true,
        avatar: true,
        assignedIssues: {
          select: {
            id: true,
            status: true,
            scene: true,
            createdAt: true,
            resolvedAt: true,
          },
        },
      },
    });

    const agentPerformance = agentList.map((agent) => {
      const completed = agent.assignedIssues.filter(
        (i) => i.status === 'resolved' || i.status === 'closed'
      ).length;
      const inProgress = agent.assignedIssues.filter(
        (i) => i.status === 'in_progress' || i.status === 'in_review'
      ).length;
      const open = agent.assignedIssues.filter(
        (i) => i.status === 'open' || i.status === 'triaged'
      ).length;
      const total = agent.assignedIssues.length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Avg resolution time
      const resolvedWithDate = agent.assignedIssues.filter(
        (i) => (i.status === 'resolved' || i.status === 'closed') && i.resolvedAt
      );
      const avgResolutionHours = resolvedWithDate.length > 0
        ? resolvedWithDate.reduce((sum, i) => {
            const created = new Date(i.createdAt).getTime();
            const resolved = new Date(i.resolvedAt!).getTime();
            return sum + (resolved - created) / (1000 * 60 * 60);
          }, 0) / resolvedWithDate.length
        : 0;

      return {
        id: agent.id,
        name: agent.name,
        avatar: agent.avatar,
        agentStatus: agent.agentStatus,
        tasks: { total, completed, inProgress, open },
        completionRate,
        avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      };
    });

    // Weekly activity heatmap (audit logs per day for last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentWeekLogs = await db.auditLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, actorType: true },
    });

    const weeklyActivity: { date: string; count: number; agentCount: number; humanCount: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = recentWeekLogs.filter(
        (l) => new Date(l.createdAt).toISOString().split('T')[0] === dateStr
      );
      weeklyActivity.push({
        date: dateStr,
        count: dayLogs.length,
        agentCount: dayLogs.filter((l) => l.actorType === 'agent').length,
        humanCount: dayLogs.filter((l) => l.actorType === 'human').length,
      });
    }

    return NextResponse.json({
      issues: {
        total: totalIssues,
        byStatus: {
          open: openCount,
          triaged: triagedCount,
          in_progress: inProgressCount,
          in_review: inReviewCount,
          resolved: resolvedCount,
          closed: closedCount,
        },
      },
      agents: {
        total: totalAgents,
        byStatus: {
          online: onlineAgents,
          busy: busyAgents,
          offline: offlineAgents,
        },
      },
      humans: {
        total: totalHumans,
      },
      inspirations: {
        total: totalInspirations,
        byStatus: {
          pending: pendingInspirations,
          analyzing: analyzingInspirations,
          converted: convertedInspirations,
          dismissed: dismissedInspirations,
        },
      },
      sessions: {
        active: activeSessions,
      },
      daemons: {
        online: onlineDaemons,
      },
      recentActivity,
      agentPerformance,
      weeklyActivity,
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
