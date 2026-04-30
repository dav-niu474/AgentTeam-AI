import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/inspirations - List inspirations, filter by ?status=pending&creatorId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const creatorId = searchParams.get('creatorId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (creatorId) where.creatorId = creatorId;

    const inspirations = await db.inspiration.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issues: {
          select: { id: true, title: true, status: true, priority: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(inspirations);
  } catch (error) {
    console.error('Failed to list inspirations:', error);
    return NextResponse.json(
      { error: 'Failed to list inspirations' },
      { status: 500 }
    );
  }
}

// POST /api/inspirations - Create inspiration (user's raw idea/input)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, source = 'chat', creatorId } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!creatorId) {
      return NextResponse.json(
        { error: 'Creator ID is required' },
        { status: 400 }
      );
    }

    // Validate creator exists
    const creator = await db.member.findUnique({ where: { id: creatorId } });
    if (!creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 400 }
      );
    }

    const inspiration = await db.inspiration.create({
      data: {
        content,
        source,
        creatorId,
      },
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issues: true,
      },
    });

    return NextResponse.json(inspiration, { status: 201 });
  } catch (error) {
    console.error('Failed to create inspiration:', error);
    return NextResponse.json(
      { error: 'Failed to create inspiration' },
      { status: 500 }
    );
  }
}
