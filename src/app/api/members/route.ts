import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';

// GET /api/members - List all members, support ?type=agent or ?type=human filter
export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where = type ? { type } : {};

    const members = await db.member.findMany({
      where,
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error('Failed to list members:', error);
    return NextResponse.json(
      { error: 'Failed to list members' },
      { status: 500 }
    );
  }
}

// POST /api/members - Create a new member (human or agent)
export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const {
      type = 'human',
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
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (type !== 'human' && type !== 'agent') {
      return NextResponse.json(
        { error: 'Type must be "human" or "agent"' },
        { status: 400 }
      );
    }

    const member = await db.member.create({
      data: {
        type,
        name,
        avatar,
        email,
        role: type === 'human' ? role : null,
        capabilities: capabilities ? JSON.stringify(capabilities) : null,
        agentGroup: type === 'agent' ? agentGroup : null,
        daemonId: type === 'agent' ? daemonId : null,
        agentStatus: type === 'agent' ? (agentStatus || 'offline') : null,
        description: type === 'agent' ? description : null,
        systemPrompt: type === 'agent' ? systemPrompt : null,
      },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    // Broadcast real-time event
    if (type === 'agent') {
      broadcastEvent('agent:status', { memberId: member.id, name, status: agentStatus || 'offline' });
    }

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Failed to create member:', error);
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  }
}
