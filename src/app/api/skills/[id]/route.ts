import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/skills/[id] - Get skill
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const skill = await db.skill.findUnique({
      where: { id },
      include: {
        agentSkills: {
          include: {
            agent: {
              select: { id: true, name: true, avatar: true, agentStatus: true },
            },
          },
        },
        _count: {
          select: { agentSkills: true },
        },
      },
    });

    if (!skill) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(skill);
  } catch (error) {
    console.error('Failed to get skill:', error);
    return NextResponse.json(
      { error: 'Failed to get skill' },
      { status: 500 }
    );
  }
}

// PATCH /api/skills/[id] - Update skill
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const {
      name,
      description,
      promptTemplate,
      requiredTools,
      acceptanceCriteria,
      version,
      usageCount,
      isBuiltIn,
      scene,
    } = body;

    const existing = await db.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // Check name uniqueness if changing name
    if (name && name !== existing.name) {
      const nameConflict = await db.skill.findUnique({ where: { name } });
      if (nameConflict) {
        return NextResponse.json(
          { error: 'Skill with this name already exists' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (promptTemplate !== undefined) updateData.promptTemplate = promptTemplate;
    if (requiredTools !== undefined) updateData.requiredTools = JSON.stringify(requiredTools);
    if (acceptanceCriteria !== undefined) updateData.acceptanceCriteria = acceptanceCriteria;
    if (version !== undefined) updateData.version = version;
    if (usageCount !== undefined) updateData.usageCount = usageCount;
    if (isBuiltIn !== undefined) updateData.isBuiltIn = isBuiltIn;
    if (scene !== undefined) updateData.scene = scene;

    const skill = await db.skill.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { agentSkills: true },
        },
      },
    });

    return NextResponse.json(skill);
  } catch (error) {
    console.error('Failed to update skill:', error);
    return NextResponse.json(
      { error: 'Failed to update skill' },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/[id] - Delete skill
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const existing = await db.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Skill not found' },
        { status: 404 }
      );
    }

    // Delete related agent skills first
    await db.agentSkill.deleteMany({ where: { skillId: id } });
    await db.skill.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete skill:', error);
    return NextResponse.json(
      { error: 'Failed to delete skill' },
      { status: 500 }
    );
  }
}
