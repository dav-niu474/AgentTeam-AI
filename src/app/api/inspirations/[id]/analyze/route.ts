import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';
import ZAI from 'z-ai-web-dev-sdk';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/inspirations/[id]/analyze - Trigger Agent analysis of an inspiration
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { agentId } = body;

    // Get the inspiration
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

    // Determine which agent to use for analysis
    let analysisAgentId = agentId;
    if (!analysisAgentId) {
      // Find the first available online agent
      const agent = await db.member.findFirst({
        where: { type: 'agent', agentStatus: 'online' },
      });
      if (!agent) {
        // Reset status and return error
        await db.inspiration.update({
          where: { id },
          data: { status: 'pending' },
        });
        return NextResponse.json(
          { error: 'No online agent available for analysis' },
          { status: 400 }
        );
      }
      analysisAgentId = agent.id;
    }

    // Validate agent exists
    const agent = await db.member.findUnique({ where: { id: analysisAgentId } });
    if (!agent || agent.type !== 'agent') {
      await db.inspiration.update({
        where: { id },
        data: { status: 'pending' },
      });
      return NextResponse.json(
        { error: 'Agent not found or is not an agent' },
        { status: 400 }
      );
    }

    // Call LLM to analyze the inspiration
    const zai = await ZAI.create();
    const analysisResponse = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an AI agent analyzing user ideas for a collaborative work platform. Your job is to:
1. Understand the user's intent and requirements
2. Break down the idea into actionable tasks (Issues)
3. For each task, provide: title, description, priority (low/medium/high/urgent), scene (code-gen/doc/analysis/review/custom), and labels (array of strings)
4. Return your analysis as a JSON array of tasks

Respond ONLY with a valid JSON array. Each element should have: title, description, priority, scene, labels
Example: [{"title": "...", "description": "...", "priority": "medium", "scene": "code-gen", "labels": ["backend", "api"]}]`,
        },
        {
          role: 'user',
          content: inspiration.content,
        },
      ],
    });

    // Parse the LLM response
    let issuesData: Array<{
      title: string;
      description: string;
      priority: string;
      scene: string;
      labels: string[];
    }> = [];

    try {
      const responseContent = analysisResponse.choices?.[0]?.message?.content || '';
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        issuesData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse LLM response:', parseError);
      // If parsing fails, create a single issue from the original content
      issuesData = [{
        title: inspiration.content.substring(0, 100),
        description: inspiration.content,
        priority: 'medium',
        scene: 'custom',
        labels: ['auto-created'],
      }];
    }

    // Create issues from the analysis
    const createdIssues = [];
    for (const issueData of issuesData) {
      const issue = await db.issue.create({
        data: {
          title: issueData.title,
          description: issueData.description || '',
          priority: issueData.priority || 'medium',
          scene: issueData.scene || 'custom',
          labels: issueData.labels ? JSON.stringify(issueData.labels) : null,
          creatorId: analysisAgentId,
          assigneeId: analysisAgentId,
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

      // Create audit log for each issue
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
        },
      });
    }

    // Update inspiration status to converted
    const updatedInspiration = await db.inspiration.update({
      where: { id },
      data: {
        status: 'converted',
        analysisResult: JSON.stringify({
          agentId: analysisAgentId,
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
          select: { id: true, title: true, status: true, priority: true },
        },
      },
    });

    // Create audit log for the analysis
    await createAuditLog({
      actorId: analysisAgentId,
      actorType: 'agent',
      action: 'analyze_inspiration',
      targetType: 'inspiration',
      targetId: id,
      details: {
        issuesCreated: createdIssues.length,
      },
    });

    // Broadcast real-time events
    broadcastEvent('inspiration:update', { inspirationId: id, status: 'converted', issuesCreated: createdIssues.length });
    broadcastEvent('issue:created', { count: createdIssues.length, inspirationId: id, agentId: analysisAgentId });

    return NextResponse.json({
      inspiration: updatedInspiration,
      issues: createdIssues,
    });
  } catch (error) {
    console.error('Failed to analyze inspiration:', error);

    // Try to reset inspiration status on error
    try {
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
