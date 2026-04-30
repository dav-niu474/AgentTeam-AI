import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/inspirations/[id] - Get inspiration with related issues
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const inspiration = await db.inspiration.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issues: {
          include: {
            creator: {
              select: { id: true, name: true, type: true, avatar: true },
            },
            assignee: {
              select: { id: true, name: true, type: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inspiration) {
      return NextResponse.json(
        { error: 'Inspiration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(inspiration);
  } catch (error) {
    console.error('Failed to get inspiration:', error);
    return NextResponse.json(
      { error: 'Failed to get inspiration' },
      { status: 500 }
    );
  }
}

// PATCH /api/inspirations/[id] - Update inspiration status (analyzing → converted, etc.)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { status, analysisResult, analyzedAt } = body;

    const existing = await db.inspiration.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Inspiration not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (analysisResult !== undefined) updateData.analysisResult = JSON.stringify(analysisResult);
    if (analyzedAt !== undefined) updateData.analyzedAt = analyzedAt;

    // If status is being changed to 'analyzing' or 'converted', set analyzedAt automatically
    if (status === 'analyzing' && !analyzedAt) {
      updateData.analyzedAt = new Date();
    }

    const inspiration = await db.inspiration.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issues: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    return NextResponse.json(inspiration);
  } catch (error) {
    console.error('Failed to update inspiration:', error);
    return NextResponse.json(
      { error: 'Failed to update inspiration' },
      { status: 500 }
    );
  }
}
