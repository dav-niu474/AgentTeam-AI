import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

// GET /api/audit-logs - List audit logs with filters
export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const actorId = searchParams.get('actorId');
    const action = searchParams.get('action');
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: Record<string, unknown> = {};
    if (actorId) where.actorId = actorId;
    if (action) where.action = action;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, type: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Failed to list audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to list audit logs' },
      { status: 500 }
    );
  }
}
