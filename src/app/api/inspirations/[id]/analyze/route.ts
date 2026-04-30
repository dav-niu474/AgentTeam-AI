import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';
import { parseJsonField } from '@/lib/api';
import ZAI from 'z-ai-web-dev-sdk';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/inspirations/[id]/analyze - Agent-driven inspiration analysis
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await ensureDbInitialized();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { agentId } = body;

    // Get the inspiration with creator info
    const inspiration = await db.inspiration.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!inspiration) {
      return NextResponse.json(
        { error: 'Inspiration not found' },
        { status: 404 }
      );
    }

    if (inspiration.status === 'converted') {
      return NextResponse.json(
        { error: 'Inspiration has already been converted' },
        { status: 400 }
      );
    }

    // Update status to analyzing
    await db.inspiration.update({
      where: { id },
      data: { status: 'analyzing', analyzedAt: new Date() },
    });

    // ---- Step 1: Find an available online Agent ----
    let analysisAgentId = agentId;
    let agent = analysisAgentId
      ? await db.member.findUnique({ where: { id: analysisAgentId } })
      : null;

    if (!agent || agent.type !== 'agent') {
      // Find the best available online agent (prefer online > busy > offline)
      agent = await db.member.findFirst({
        where: { type: 'agent', agentStatus: 'online' },
        orderBy: { createdAt: 'asc' },
      });
      if (!agent) {
        // Try busy agents as fallback
        agent = await db.member.findFirst({
          where: { type: 'agent', agentStatus: 'busy' },
          orderBy: { createdAt: 'asc' },
        });
      }
      if (!agent) {
        // Reset status and return error
        await db.inspiration.update({
          where: { id },
          data: { status: 'pending' },
        });
        return NextResponse.json(
          { error: 'No available agent for analysis. Please create and bring an agent online first.' },
          { status: 400 }
        );
      }
      analysisAgentId = agent.id;
    }

    // ---- Step 2: Build Agent-aware LLM prompt ----
    const agentCapabilities = parseJsonField<string[]>(agent.capabilities, []);
    const agentSystemPrompt = agent.systemPrompt || 'You are a helpful AI assistant.';
    const agentName = agent.name;

    const zai = await ZAI.create();
    const analysisResponse = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are ${agentName}, an AI agent with capabilities: ${agentCapabilities.join(', ') || 'general'}.
Your role: ${agentSystemPrompt}

Analyze this user inspiration and create appropriate issues:
"${inspiration.content}"

You must respond ONLY with a valid JSON object (no markdown, no code fences) in this exact format:
{
  "analysis": "Your understanding of the user's idea and how it should be broken down",
  "issues": [
    {
      "title": "Issue title",
      "description": "Detailed description of what needs to be done",
      "priority": "high|medium|low|urgent",
      "scene": "code-gen|doc|analysis|review|custom",
      "labels": ["label1", "label2"]
    }
  ],
  "suggestedAssignee": "self"
}

Important:
- Create as many issues as needed based on complexity (1-5 typically)
- Set priority based on urgency and importance
- Set scene based on the nature of each task
- For suggestedAssignee, use "self" if you can handle it, or suggest another agent name
- Be specific and actionable in issue titles and descriptions`,
        },
        {
          role: 'user',
          content: `Please analyze this inspiration and create issues: "${inspiration.content}"`,
        },
      ],
    });

    // ---- Step 3: Parse the LLM response ----
    interface AgentAnalysisResult {
      analysis: string;
      issues: Array<{
        title: string;
        description: string;
        priority: string;
        scene: string;
        labels: string[];
      }>;
      suggestedAssignee: string;
    }

    let analysisData: AgentAnalysisResult = {
      analysis: '',
      issues: [],
      suggestedAssignee: 'self',
    };

    try {
      const responseContent = analysisResponse.choices?.[0]?.message?.content || '';
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        analysisData = {
          analysis: parsed.analysis || '',
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          suggestedAssignee: parsed.suggestedAssignee || 'self',
        };
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
    }

    // Fallback: if no issues were parsed, create a single issue from the original content
    if (analysisData.issues.length === 0) {
      analysisData = {
        analysis: `Agent ${agentName} analyzed the inspiration but could not parse structured issues. Creating a single task.`,
        issues: [{
          title: inspiration.content.substring(0, 100),
          description: inspiration.content,
          priority: 'medium',
          scene: 'custom',
          labels: ['auto-created'],
        }],
        suggestedAssignee: 'self',
      };
    }

    // ---- Step 4: Resolve assignee based on suggestedAssignee ----
    let assigneeId = analysisAgentId; // Default: assign to self (the analyzing agent)

    if (analysisData.suggestedAssignee && analysisData.suggestedAssignee !== 'self') {
      // Try to find the suggested agent
      const suggestedAgent = await db.member.findFirst({
        where: {
          type: 'agent',
          name: { contains: analysisData.suggestedAssignee },
        },
      });
      if (suggestedAgent) {
        assigneeId = suggestedAgent.id;
      }
    }

    // ---- Step 5: Create issues with Agent as creator ----
    const createdIssues = [];
    for (const issueData of analysisData.issues) {
      const issue = await db.issue.create({
        data: {
          title: issueData.title,
          description: issueData.description || '',
          priority: ['low', 'medium', 'high', 'urgent'].includes(issueData.priority)
            ? issueData.priority
            : 'medium',
          scene: ['code-gen', 'doc', 'analysis', 'review', 'custom'].includes(issueData.scene)
            ? issueData.scene
            : 'custom',
          labels: issueData.labels ? JSON.stringify(issueData.labels) : null,
          creatorId: analysisAgentId, // KEY: Agent creates the issue, not the human
          assigneeId: assigneeId,     // Agent assigns to itself or another agent
          inspirationId: id,
        },
        include: {
          creator: {
            select: { id: true, name: true, type: true, avatar: true },
          },
          assignee: {
            select: { id: true, name: true, type: true, avatar: true },
          },
        },
      });

      createdIssues.push(issue);

      // Create audit log: Agent created this issue
      await createAuditLog({
        actorId: analysisAgentId,
        actorType: 'agent',
        action: 'create_issue_from_inspiration',
        targetType: 'issue',
        targetId: issue.id,
        details: {
          inspirationId: id,
          title: issueData.title,
          priority: issueData.priority,
          scene: issueData.scene,
          agentName: agentName,
        },
      });
    }

    // ---- Step 6: Update inspiration with analysis results ----
    const updatedInspiration = await db.inspiration.update({
      where: { id },
      data: {
        status: 'converted',
        analysisResult: JSON.stringify({
          agentId: analysisAgentId,
          agentName: agentName,
          analysis: analysisData.analysis,
          suggestedAssignee: analysisData.suggestedAssignee,
          issuesCreated: createdIssues.length,
          analyzedAt: new Date().toISOString(),
          rawResponse: analysisResponse.choices?.[0]?.message?.content || '',
        }),
      },
      include: {
        creator: {
          select: { id: true, name: true, type: true, avatar: true },
        },
        issues: {
          select: { id: true, title: true, status: true, priority: true, scene: true },
        },
      },
    });

    // Create audit log for the analysis itself
    await createAuditLog({
      actorId: analysisAgentId,
      actorType: 'agent',
      action: 'analyze_inspiration',
      targetType: 'inspiration',
      targetId: id,
      details: {
        agentName: agentName,
        issuesCreated: createdIssues.length,
        analysis: analysisData.analysis,
      },
    });

    // Broadcast real-time events
    broadcastEvent('inspiration:update', {
      inspirationId: id,
      status: 'converted',
      issuesCreated: createdIssues.length,
      agentId: analysisAgentId,
    });
    broadcastEvent('issue:created', {
      count: createdIssues.length,
      inspirationId: id,
      agentId: analysisAgentId,
    });

    return NextResponse.json({
      inspiration: updatedInspiration,
      issues: createdIssues,
      analysis: {
        agentId: analysisAgentId,
        agentName: agentName,
        analysis: analysisData.analysis,
        suggestedAssignee: analysisData.suggestedAssignee,
        issuesCreated: createdIssues.length,
      },
    });
  } catch (error) {
    console.error('Failed to analyze inspiration:', error);

    // Try to reset inspiration status on error
    try {
      const { id } = await context.params;
      await db.inspiration.update({
        where: { id },
        data: { status: 'pending' },
      });
    } catch {
      // Ignore reset errors
    }

    return NextResponse.json(
      { error: 'Failed to analyze inspiration' },
      { status: 500 }
    );
  }
}
