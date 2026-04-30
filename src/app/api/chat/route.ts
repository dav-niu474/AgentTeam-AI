import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

// POST /api/chat - Chat with an AI agent about an issue
// Body: { issueId: string, message: string, agentId?: string }
export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { issueId, message, agentId } = body;

    if (!issueId || !message) {
      return NextResponse.json(
        { error: 'issueId and message are required' },
        { status: 400 }
      );
    }

    // Fetch the issue with context
    const issue = await db.issue.findUnique({
      where: { id: issueId },
      include: {
        creator: { select: { id: true, name: true, type: true } },
        assignee: { select: { id: true, name: true, type: true, systemPrompt: true, capabilities: true } },
        comments: {
          include: {
            author: { select: { id: true, name: true, type: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
    });

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    // Determine which agent to chat with
    const chatAgentId = agentId || issue.assigneeId;
    if (!chatAgentId) {
      return NextResponse.json(
        { error: 'No agent assigned to this issue. Please assign an agent first.' },
        { status: 400 }
      );
    }

    const agent = await db.member.findUnique({
      where: { id: chatAgentId },
    });

    if (!agent || agent.type !== 'agent') {
      return NextResponse.json(
        { error: 'Assigned member is not an agent' },
        { status: 400 }
      );
    }

    // Create the human comment
    const humanComment = await db.comment.create({
      data: {
        content: message,
        authorId: (body as Record<string, unknown>).userId as string || issue.creatorId,
        issueId,
        authorType: 'human',
      },
      include: {
        author: { select: { id: true, name: true, type: true, avatar: true } },
      },
    });

    // Build context for the AI
    const commentsContext = issue.comments
      .map((c) => `${c.authorType === 'agent' ? '🤖' : '👤'} ${c.author?.name || 'Unknown'}: ${c.content}`)
      .join('\n');

    const systemPrompt = agent.systemPrompt || 'You are a helpful AI agent working on software development tasks.';
    const capabilities = agent.capabilities ? JSON.parse(agent.capabilities as string) : [];

    const contextMessage = `You are ${agent.name}, an AI agent with capabilities: ${Array.isArray(capabilities) ? capabilities.join(', ') : capabilities}.

Current task: ${issue.title}
Description: ${issue.description || 'No description'}
Status: ${issue.status}
Priority: ${issue.priority}

Recent conversation:
${commentsContext || 'No previous comments.'}

Human message: ${message}

Please provide a helpful response about this task. Be concise and actionable.`;

    // Generate AI response using z-ai-web-dev-sdk
    let aiResponse: string;
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const result = await zai.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextMessage },
        ],
      });
      aiResponse = result.choices?.[0]?.message?.content || result.content || result.text || 'I received your message but could not generate a response. Please try again.';

      if (typeof aiResponse !== 'string') {
        aiResponse = JSON.stringify(aiResponse);
      }
    } catch (aiError) {
      console.error('AI generation failed:', aiError);
      // Fallback response when AI is unavailable
      aiResponse = `收到你的消息。我是 ${agent.name}，目前暂时无法生成详细回复，但已记录你的输入。`;

      // If AI fails, still create a basic agent comment
      const agentComment = await db.comment.create({
        data: {
          content: aiResponse,
          authorId: chatAgentId,
          issueId,
          authorType: 'agent',
          metadata: JSON.stringify({ isChatResponse: true, fallback: true }),
        },
        include: {
          author: { select: { id: true, name: true, type: true, avatar: true } },
        },
      });

      // Create audit log
      await createAuditLog({
        actorId: chatAgentId,
        actorType: 'agent',
        action: 'add_comment',
        targetType: 'comment',
        targetId: agentComment.id,
        details: { issueId, isChatResponse: true, fallback: true },
      });

      broadcastEvent('comment:added', { commentId: agentComment.id, issueId, authorId: chatAgentId, authorType: 'agent' });

      return NextResponse.json({
        humanComment,
        agentComment,
        fallback: true,
      });
    }

    // Create the agent response comment
    const agentComment = await db.comment.create({
      data: {
        content: aiResponse,
        authorId: chatAgentId,
        issueId,
        authorType: 'agent',
        metadata: JSON.stringify({ isChatResponse: true }),
      },
      include: {
        author: { select: { id: true, name: true, type: true, avatar: true } },
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: chatAgentId,
      actorType: 'agent',
      action: 'add_comment',
      targetType: 'comment',
      targetId: agentComment.id,
      details: { issueId, isChatResponse: true },
    });

    // Broadcast real-time event
    broadcastEvent('comment:added', { commentId: agentComment.id, issueId, authorId: chatAgentId, authorType: 'agent' });

    return NextResponse.json({
      humanComment,
      agentComment,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to process chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
