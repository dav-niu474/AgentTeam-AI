import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/daemons/[id] - Get daemon
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    const daemon = await db.daemon.findUnique({ where: { id } });

    if (!daemon) {
      return NextResponse.json(
        { error: 'Daemon not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(daemon);
  } catch (error) {
    console.error('Failed to get daemon:', error);
    return NextResponse.json(
      { error: 'Failed to get daemon' },
      { status: 500 }
    );
  }
}

// PATCH /api/daemons/[id] - Update heartbeat, status, available tools
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;
    const body = await request.json();
    const { name, host, port, status, availableTools } = body;

    const existing = await db.daemon.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Daemon not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      // Always update heartbeat on PATCH
      lastHeartbeat: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (port !== undefined) updateData.port = port;
    if (status !== undefined) updateData.status = status;
    if (availableTools !== undefined) updateData.availableTools = JSON.stringify(availableTools);

    const daemon = await db.daemon.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(daemon);
  } catch (error) {
    console.error('Failed to update daemon:', error);
    return NextResponse.json(
      { error: 'Failed to update daemon' },
      { status: 500 }
    );
  }
}
