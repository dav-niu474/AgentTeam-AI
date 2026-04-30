import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

// GET /api/notifications - Return recent audit logs as notifications
// Query params: limit (default 50), unreadIds (comma-separated IDs that are unread)
export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const unreadIdsStr = searchParams.get('unreadIds') || '';

    // Parse unread IDs from client (comma-separated)
    const unreadIds = unreadIdsStr
      ? unreadIdsStr.split(',').filter(Boolean)
      : [];

    const logs = await db.auditLog.findMany({
      include: {
        actor: {
          select: { id: true, name: true, type: true, avatar: true, agentStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Transform audit logs into notification format
    const notifications = logs.map((log) => {
      const isRead = !unreadIds.includes(log.id);

      // Determine notification icon type based on action
      let iconType = 'info';
      if (log.action.includes('create') || log.action.includes('add')) {
        iconType = 'create';
      } else if (log.action.includes('status') || log.action.includes('change')) {
        iconType = 'change';
      } else if (log.action.includes('assign') || log.action.includes('reassign')) {
        iconType = 'assign';
      } else if (log.action.includes('delete') || log.action.includes('remove')) {
        iconType = 'delete';
      } else if (log.action.includes('analyze')) {
        iconType = 'analyze';
      } else if (log.action.includes('execute') || log.action.includes('scan')) {
        iconType = 'execute';
      }

      // Build a human-readable description
      let description = '';
      const actorName = log.actor?.name || 'System';
      const actorType = log.actorType || 'system';

      if (actorType === 'agent') {
        description = `🤖 ${actorName}`;
      } else if (actorType === 'human') {
        description = `👤 ${actorName}`;
      } else {
        description = '⚙️ System';
      }

      // Action-specific descriptions
      const actionMap: Record<string, string> = {
        create_issue: '创建了任务',
        change_status: '变更了状态',
        reassign_issue: '重新指派了任务',
        add_comment: '添加了评论',
        analyze_inspiration: '分析了灵感',
        auto_assign: '自动指派了任务',
        scan_issues: '扫描了任务',
        execute_task: '执行了任务',
        register_agent: '注册了 Agent',
        register_daemon: '注册了 Daemon',
      };

      description += ` ${actionMap[log.action] || log.action}`;

      // Add target info if available
      if (log.targetType) {
        const targetTypeMap: Record<string, string> = {
          issue: '任务',
          comment: '评论',
          session: '会话',
          inspiration: '灵感',
          member: '成员',
          daemon: 'Daemon',
        };
        description += ` → ${targetTypeMap[log.targetType] || log.targetType}`;
      }

      // Parse details for extra context
      let details: Record<string, unknown> = {};
      if (log.details) {
        try {
          details = JSON.parse(log.details) as Record<string, unknown>;
        } catch {
          // ignore parse errors
        }
      }

      return {
        id: log.id,
        actorId: log.actorId,
        actorName: log.actor?.name || 'System',
        actorType: log.actorType,
        actorAvatar: log.actor?.avatar || null,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        description,
        iconType,
        details,
        read: isRead,
        createdAt: log.createdAt,
      };
    });

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error('Failed to list notifications:', error);
    return NextResponse.json(
      { error: 'Failed to list notifications' },
      { status: 500 }
    );
  }
}
