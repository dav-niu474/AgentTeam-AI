import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/memory - List memory entries for a user: ?userId=xxx&category=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { userId };
    if (category) where.category = category;

    const entries = await db.memoryEntry.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Failed to list memory entries:', error);
    return NextResponse.json(
      { error: 'Failed to list memory entries' },
      { status: 500 }
    );
  }
}

// POST /api/memory - Create/update memory entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, category, key, value, confidence = 0.5, source } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      );
    }

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      );
    }

    // Use upsert since (userId, category, key) is unique
    const entry = await db.memoryEntry.upsert({
      where: {
        userId_category_key: { userId, category, key },
      },
      create: {
        userId,
        category,
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        confidence,
        source,
      },
      update: {
        value: typeof value === 'string' ? value : JSON.stringify(value),
        confidence,
        source,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Failed to create/update memory entry:', error);
    return NextResponse.json(
      { error: 'Failed to create/update memory entry' },
      { status: 500 }
    );
  }
}
