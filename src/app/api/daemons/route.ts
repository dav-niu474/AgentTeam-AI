import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/daemons - List daemons
export async function GET(_request: NextRequest) {
  try {
    const daemons = await db.daemon.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(daemons);
  } catch (error) {
    console.error('Failed to list daemons:', error);
    return NextResponse.json(
      { error: 'Failed to list daemons' },
      { status: 500 }
    );
  }
}

// POST /api/daemons - Register a daemon
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, host, port, availableTools, status = 'online' } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const daemon = await db.daemon.create({
      data: {
        name,
        host,
        port,
        status,
        availableTools: availableTools ? JSON.stringify(availableTools) : null,
        lastHeartbeat: new Date(),
      },
    });

    return NextResponse.json(daemon, { status: 201 });
  } catch (error) {
    console.error('Failed to register daemon:', error);
    return NextResponse.json(
      { error: 'Failed to register daemon' },
      { status: 500 }
    );
  }
}
