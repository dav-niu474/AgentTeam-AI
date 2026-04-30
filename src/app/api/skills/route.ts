import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';

// GET /api/skills - List all skills
export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const scene = searchParams.get('scene');
    const isBuiltIn = searchParams.get('isBuiltIn');

    const where: Record<string, unknown> = {};
    if (scene) where.scene = scene;
    if (isBuiltIn !== null && isBuiltIn !== undefined) {
      where.isBuiltIn = isBuiltIn === 'true';
    }

    const skills = await db.skill.findMany({
      where,
      include: {
        agentSkills: {
          include: {
            agent: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        _count: {
          select: { agentSkills: true },
        },
      },
      orderBy: { usageCount: 'desc' },
    });

    return NextResponse.json(skills);
  } catch (error) {
    console.error('Failed to list skills:', error);
    return NextResponse.json(
      { error: 'Failed to list skills' },
      { status: 500 }
    );
  }
}

// POST /api/skills - Create a new skill
export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const {
      name,
      description,
      promptTemplate,
      requiredTools,
      acceptanceCriteria,
      isBuiltIn = false,
      scene,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    if (!promptTemplate) {
      return NextResponse.json(
        { error: 'Prompt template is required' },
        { status: 400 }
      );
    }

    // Check if skill name already exists
    const existing = await db.skill.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: 'Skill with this name already exists' },
        { status: 409 }
      );
    }

    const skill = await db.skill.create({
      data: {
        name,
        description,
        promptTemplate,
        requiredTools: requiredTools ? JSON.stringify(requiredTools) : null,
        acceptanceCriteria,
        isBuiltIn,
        scene,
      },
      include: {
        _count: {
          select: { agentSkills: true },
        },
      },
    });

    return NextResponse.json(skill, { status: 201 });
  } catch (error) {
    console.error('Failed to create skill:', error);
    return NextResponse.json(
      { error: 'Failed to create skill' },
      { status: 500 }
    );
  }
}
