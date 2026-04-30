import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/stats - Dashboard statistics
export async function GET() {
  try {
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
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
