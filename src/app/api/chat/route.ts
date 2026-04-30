import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

// Helper: Get or create a session for (agentId, issueId)
async function getOrCreateSession(agentId: string, issueId: string) {
  // Try to find existing session
  let session = await db.session.findUnique({
    where: { agentId_issueId: { agentId, issueId } },
  });

  if (!session) {
    // Create new session
    session = await db.session.create({
      data: {
        agentId,
        issueId,
        status: 'active',
        messages: JSON.stringify([]),
      },
    });
    broadcastEvent('session:update', { sessionId: session.id, agentId, issueId, status: 'active' });
  }

  return session;
}

// Helper: Add message to session
async function addMessageToSession(
  sessionId: string,
  role: 'system' | 'user' | 'assistant',
  content: string,
) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return;

  const messages = JSON.parse(session.messages || '[]');
  messages.push({ role, content, timestamp: new Date().toISOString() });

  await db.session.update({
    where: { id: sessionId },
    data: {
      messages: JSON.stringify(messages),
      updatedAt: new Date(),
    },
  });

  return messages;
}

// Helper: Get session messages as LLM conversation format
async function getSessionMessages(sessionId: string) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return [];

  const rawMessages = JSON.parse(session.messages || '[]');
  return rawMessages.map((m: { role: string; content: string }) => ({
    role: m.role,
    content: m.content,
  }));
}

// POST /api/chat - Chat with an AI agent about an issue
// Body: { issueId: string, message: string, agentId?: string, userId?: string }
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

    // Get or create session for this (agent, issue) pair
    const session = await getOrCreateSession(chatAgentId, issueId);

    // Create the human comment
    const userId = (body as Record<string, unknown>).userId as string || issue.creatorId;
    const humanComment = await db.comment.create({
      data: {
        content: message,
        authorId: userId,
        issueId,
        authorType: 'human',
        metadata: JSON.stringify({ sessionId: session.id }),
      },
      include: {
        author: { select: { id: true, name: true, type: true, avatar: true } },
      },
    });

    // Add user message to session
    await addMessageToSession(session.id, 'user', message);

    // Build LLM conversation from session history + context
    const systemPrompt = agent.systemPrompt || 'You are a helpful AI agent working on software development tasks.';
    const capabilities = (() => {
      try {
        const parsed = JSON.parse(agent.capabilities || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    const contextSystemMessage = `You are ${agent.name}, an AI agent specializing in: ${capabilities.join(', ')}.

Current Task Context:
- Title: ${issue.title}
- Description: ${issue.description || 'No description provided'}
- Status: ${issue.status}
- Priority: ${issue.priority}
- Scene: ${issue.scene || 'general'}

Instructions:
- Be concise, actionable, and professional
- If discussing code, provide specific examples
- If analyzing, provide structured findings
- Always respond in the same language the user writes in
- Reference specific details from the task context when relevant`;

    // Get conversation history from session
    const sessionMessages = await getSessionMessages(session.id);

    // Build messages array for LLM
    const llmMessages = [
      { role: 'system' as const, content: contextSystemMessage },
      ...sessionMessages.slice(-20), // Last 20 messages for context window
    ];

    // If session is new (no history), add the system prompt
    if (sessionMessages.length <= 1) {
      // Already have the system message, just proceed
    }

    // Generate AI response using z-ai-web-dev-sdk
    let aiResponse: string;
    let isFallback = false;

    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const result = await zai.chat.completions.create({
        messages: llmMessages,
        temperature: 0.7,
        max_tokens: 2000,
      });
      aiResponse = result.choices?.[0]?.message?.content || result.content || result.text || '';

      if (typeof aiResponse !== 'string') {
        aiResponse = JSON.stringify(aiResponse);
      }

      if (!aiResponse || aiResponse.trim().length === 0) {
        throw new Error('Empty response from LLM');
      }
    } catch (aiError) {
      console.error('[chat] AI generation failed:', aiError);
      isFallback = true;
      aiResponse = `收到你的消息。我是 ${agent.name}，目前暂时无法生成详细回复，但已记录你的输入。请稍后重试。`;
    }

    // Add assistant message to session
    await addMessageToSession(session.id, 'assistant', aiResponse);

    // Create the agent response comment
    const agentComment = await db.comment.create({
      data: {
        content: aiResponse,
        authorId: chatAgentId,
        issueId,
        authorType: 'agent',
        metadata: JSON.stringify({
          isChatResponse: true,
          sessionId: session.id,
          fallback: isFallback,
        }),
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
      details: { issueId, isChatResponse: true, sessionId: session.id, fallback: isFallback },
    });

    // Broadcast real-time event
    broadcastEvent('comment:added', { commentId: agentComment.id, issueId, authorId: chatAgentId, authorType: 'agent', sessionId: session.id });
    broadcastEvent('session:update', { sessionId: session.id, agentId: chatAgentId, issueId, status: 'active' });

    return NextResponse.json({
      humanComment,
      agentComment,
      session: {
        id: session.id,
        status: session.status,
      },
      fallback: isFallback || undefined,
    }, { status: 201 });
  } catch (error) {
    console.error('[chat] Failed to process chat:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
