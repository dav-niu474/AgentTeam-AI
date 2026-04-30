import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/memory/[id] - Get memory entry
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    const entry = await db.memoryEntry.findUnique({ where: { id } });

    if (!entry) {
      return NextResponse.json(
        { error: 'Memory entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to get memory entry:', error);
    return NextResponse.json(
      { error: 'Failed to get memory entry' },
      { status: 500 }
    );
  }
}

// PATCH /api/memory/[id] - Update memory entry
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;
    const body = await request.json();
    const { value, confidence, source, category, key } = body;

    const existing = await db.memoryEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Memory entry not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (value !== undefined) updateData.value = typeof value === 'string' ? value : JSON.stringify(value);
    if (confidence !== undefined) updateData.confidence = confidence;
    if (source !== undefined) updateData.source = source;
    if (category !== undefined) updateData.category = category;
    if (key !== undefined) updateData.key = key;

    const entry = await db.memoryEntry.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Failed to update memory entry:', error);
    return NextResponse.json(
      { error: 'Failed to update memory entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/memory/[id] - Delete memory entry
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;

    const existing = await db.memoryEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Memory entry not found' },
        { status: 404 }
      );
    }

    await db.memoryEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete memory entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete memory entry' },
      { status: 500 }
    );
  }
}
