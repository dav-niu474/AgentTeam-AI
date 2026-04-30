import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { parseJsonField } from '@/lib/api';

// POST /api/agents/auto-assign - Find the best available agent for a task
export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { issueId, scene, capabilities } = body as {
      issueId?: string;
      scene?: string;
      capabilities?: string[];
    };

    // Get all agents with their current workload
    const agents = await db.member.findMany({
      where: { type: 'agent' },
      include: {
        assignedIssues: {
          where: { status: { in: ['in_progress', 'triaged'] } },
          select: { id: true },
        },
      },
    });

    if (agents.length === 0) {
      return NextResponse.json(
        { error: 'No agents available' },
        { status: 404 }
      );
    }

    // Score each agent based on:
    // 1. Status (online=3, busy=1, offline=0)
    // 2. Workload (fewer in_progress issues = higher score)
    // 3. Capability match (matching scene/capabilities = bonus)
    // 4. Autopilot enabled = bonus

    const scoredAgents = agents.map((agent) => {
      const agentCaps = parseJsonField<string[]>(agent.capabilities, []);
      const workload = agent.assignedIssues.length;
      const isAutopilot = agent.autopilot === true;

      // Status score
      let statusScore = 0;
      if (agent.agentStatus === 'online') statusScore = 3;
      else if (agent.agentStatus === 'busy') statusScore = 1;
      else statusScore = 0;

      // Workload score (inverse - fewer tasks = higher score, max 5)
      const workloadScore = Math.max(0, 5 - workload);

      // Capability match score
      let capMatchScore = 0;
      if (scene && agentCaps.length > 0) {
        // Check if agent capabilities match the issue scene
        if (agentCaps.includes(scene)) capMatchScore += 3;
        // Check for related capabilities
        const sceneMap: Record<string, string[]> = {
          'code-gen': ['code-gen', 'add-feature', 'fix-bug'],
          'review': ['code-review', 'testing'],
          'doc': ['doc', 'analysis'],
          'analysis': ['analysis', 'doc'],
          'custom': [],
        };
        const relatedCaps = sceneMap[scene] || [];
        for (const cap of relatedCaps) {
          if (agentCaps.includes(cap)) capMatchScore += 1;
        }
      }

      if (capabilities && capabilities.length > 0) {
        for (const cap of capabilities) {
          if (agentCaps.includes(cap)) capMatchScore += 2;
        }
      }

      // Autopilot bonus
      const autopilotBonus = isAutopilot ? 2 : 0;

      const totalScore = statusScore + workloadScore + capMatchScore + autopilotBonus;

      return {
        id: agent.id,
        name: agent.name,
        agentStatus: agent.agentStatus,
        capabilities: agentCaps,
        workload,
        autopilot: isAutopilot,
        score: totalScore,
        scoreBreakdown: {
          statusScore,
          workloadScore,
          capMatchScore,
          autopilotBonus,
        },
      };
    });

    // Sort by total score descending
    scoredAgents.sort((a, b) => b.score - a.score);

    const recommended = scoredAgents[0];

    // If an issueId was provided, auto-assign the recommended agent
    if (issueId && recommended) {
      const issue = await db.issue.findUnique({ where: { id: issueId } });
      if (issue) {
        await db.issue.update({
          where: { id: issueId },
          data: { assigneeId: recommended.id },
        });
      }
    }

    return NextResponse.json({
      recommended: recommended
        ? {
            id: recommended.id,
            name: recommended.name,
            agentStatus: recommended.agentStatus,
            capabilities: recommended.capabilities,
            workload: recommended.workload,
            autopilot: recommended.autopilot,
            score: recommended.score,
          }
        : null,
      allCandidates: scoredAgents.map((a) => ({
        id: a.id,
        name: a.name,
        agentStatus: a.agentStatus,
        workload: a.workload,
        autopilot: a.autopilot,
        score: a.score,
      })),
    });
  } catch (error) {
    console.error('Failed to auto-assign agent:', error);
    return NextResponse.json(
      { error: 'Failed to auto-assign agent' },
      { status: 500 }
    );
  }
}
