import { NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';
import { parseJsonField } from '@/lib/api';
import ZAI from 'z-ai-web-dev-sdk';

// POST /api/agents/scan - Agent proactively scans project and creates issues
export async function POST() {
  try {
    await ensureDbInitialized();
    // Find an online agent to perform the scan (prefer autopilot agents)
    const agent = await db.member.findFirst({
      where: { type: 'agent', autopilot: true, agentStatus: { in: ['online', 'busy'] } },
      orderBy: { createdAt: 'asc' },
    }) || await db.member.findFirst({
      where: { type: 'agent', agentStatus: 'online' },
      orderBy: { createdAt: 'asc' },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'No online agent available for scanning. Please bring an agent online.' },
        { status: 400 }
      );
    }

    // Gather recent project activity
    const recentAuditLogs = await db.auditLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, type: true } },
      },
    });

    const pendingInspirations = await db.inspiration.findMany({
      where: { status: 'pending' },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    const staleIssues = await db.issue.findMany({
      where: {
        status: { in: ['open', 'triaged'] },
        updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // older than 24h
      },
      take: 10,
      orderBy: { updatedAt: 'asc' },
      include: {
        creator: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    });

    const allIssues = await db.issue.findMany({
      select: { id: true, title: true, status: true, priority: true, scene: true },
    });

    const agentCapabilities = parseJsonField<string[]>(agent.capabilities, []);

    // Build activity summary for LLM
    const activitySummary = recentAuditLogs
      .map((log) => `[${log.createdAt.toISOString()}] ${log.actor?.name || 'System'} (${log.actorType}): ${log.action} on ${log.targetType}/${log.targetId}`)
      .join('\n');

    const pendingInspSummary = pendingInspirations
      .map((i) => `- "${i.content}" (created ${i.createdAt.toISOString()})`)
      .join('\n');

    const staleIssueSummary = staleIssues
      .map((i) => `- "${i.title}" (${i.status}, last updated ${i.updatedAt.toISOString()}, creator: ${i.creator?.name}, assignee: ${i.assignee?.name || 'unassigned'})`)
      .join('\n');

    const issueStats = {
      total: allIssues.length,
      byStatus: allIssues.reduce<Record<string, number>>((acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      }, {}),
    };

    // Call LLM to analyze and suggest proactive actions
    const zai = await ZAI.create();
    const scanResponse = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}, an AI agent with capabilities: ${agentCapabilities.join(', ') || 'general'}.
Your role: ${agent.systemPrompt || 'You are a proactive AI assistant.'}

You are performing a proactive scan of the project. Based on the recent activity, pending inspirations, and stale issues, identify:
1. Missing issues that should be created (e.g., unaddressed needs from pending inspirations)
2. Stale issues that need attention (e.g., issues that haven't been updated in a while)
3. Opportunities for improvement

Respond ONLY with a valid JSON object (no markdown, no code fences):
{
  "scanSummary": "Brief summary of what you found",
  "newIssues": [
    {
      "title": "Issue title",
      "description": "Why this issue should be created and what it covers",
      "priority": "high|medium|low|urgent",
      "scene": "code-gen|doc|analysis|review|custom",
      "labels": ["label1", "label2"],
      "reason": "Why you decided to create this issue"
    }
  ],
  "staleIssueActions": [
    {
      "issueTitle": "Issue title or partial match",
      "suggestedAction": "What should be done with this stale issue"
    }
  ],
  "recommendations": ["General recommendation 1", "General recommendation 2"]
}

Important:
- Only create issues that are genuinely needed - don't create duplicates
- Be conservative: 0-3 new issues is typical for a scan
- Focus on actionable, specific tasks
- Consider the project's current state and priorities`,
        },
        {
          role: 'user',
          content: `Please scan the project and identify any proactive actions needed.

## Recent Activity (last 20 actions):
${activitySummary || 'No recent activity'}

## Pending Inspirations (not yet analyzed):
${pendingInspSummary || 'No pending inspirations'}

## Stale Issues (not updated in 24h):
${staleIssueSummary || 'No stale issues'}

## Issue Statistics:
- Total: ${issueStats.total}
- By Status: ${JSON.stringify(issueStats.byStatus)}

Please analyze and suggest proactive actions.`,
        },
      ],
    });

    // Parse the LLM response
    interface ScanResult {
      scanSummary: string;
      newIssues: Array<{
        title: string;
        description: string;
        priority: string;
        scene: string;
        labels: string[];
        reason: string;
      }>;
      staleIssueActions: Array<{
        issueTitle: string;
        suggestedAction: string;
      }>;
      recommendations: string[];
    }

    let scanData: ScanResult = {
      scanSummary: '',
      newIssues: [],
      staleIssueActions: [],
      recommendations: [],
    };

    try {
      const responseContent = scanResponse.choices?.[0]?.message?.content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        scanData = {
          scanSummary: parsed.scanSummary || '',
          newIssues: Array.isArray(parsed.newIssues) ? parsed.newIssues : [],
          staleIssueActions: Array.isArray(parsed.staleIssueActions) ? parsed.staleIssueActions : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
      }
    } catch (parseError) {
      console.error('Failed to parse scan LLM response:', parseError);
    }

    // Create the suggested issues autonomously
    const createdIssues = [];
    for (const issueData of scanData.newIssues) {
      // Check for duplicate titles (exact match)
      const existing = await db.issue.findFirst({
        where: { title: issueData.title },
      });
      if (existing) continue; // Skip duplicates

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
          creatorId: agent.id, // Agent creates the issue autonomously
          assigneeId: agent.id, // Agent assigns to itself
        },
        include: {
          creator: { select: { id: true, name: true, type: true, avatar: true } },
          assignee: { select: { id: true, name: true, type: true, avatar: true } },
        },
      });

      createdIssues.push(issue);

      // Create audit log
      await createAuditLog({
        actorId: agent.id,
        actorType: 'agent',
        action: 'agent_proactive_create',
        targetType: 'issue',
        targetId: issue.id,
        details: {
          title: issueData.title,
          priority: issueData.priority,
          scene: issueData.scene,
          reason: issueData.reason,
          scanTriggered: true,
        },
      });
    }

    // Create audit log for the scan itself
    await createAuditLog({
      actorId: agent.id,
      actorType: 'agent',
      action: 'agent_scan',
      targetType: 'system',
      targetId: 'project',
      details: {
        scanSummary: scanData.scanSummary,
        issuesCreated: createdIssues.length,
        recommendationsCount: scanData.recommendations.length,
      },
    });

    // Broadcast real-time events
    if (createdIssues.length > 0) {
      broadcastEvent('issue:created', {
        count: createdIssues.length,
        agentId: agent.id,
        source: 'scan',
      });
    }
    broadcastEvent('agent:status', {
      agentId: agent.id,
      action: 'scan_completed',
    });

    return NextResponse.json({
      scanBy: {
        id: agent.id,
        name: agent.name,
      },
      scanSummary: scanData.scanSummary,
      createdIssues,
      staleIssueActions: scanData.staleIssueActions,
      recommendations: scanData.recommendations,
    });
  } catch (error) {
    console.error('Failed to scan project:', error);
    return NextResponse.json(
      { error: 'Failed to scan project' },
      { status: 500 }
    );
  }
}
