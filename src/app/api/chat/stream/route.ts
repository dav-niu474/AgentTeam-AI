import { NextRequest } from 'next/server';
import { db, ensureDbInitialized } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { broadcastEvent } from '@/lib/events';

// Helper: Get or create a session for (agentId, issueId)
async function getOrCreateSession(agentId: string, issueId: string) {
  let session = await db.session.findUnique({
    where: { agentId_issueId: { agentId, issueId } },
  });
  if (!session) {
    session = await db.session.create({
      data: { agentId, issueId, status: 'active', messages: JSON.stringify([]) },
    });
    broadcastEvent('session:update', { sessionId: session.id, agentId, issueId, status: 'active' });
  }
  return session;
}

async function addMessageToSession(sessionId: string, role: string, content: string) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return;
  const messages = JSON.parse(session.messages || '[]');
  messages.push({ role, content, timestamp: new Date().toISOString() });
  await db.session.update({
    where: { id: sessionId },
    data: { messages: JSON.stringify(messages), updatedAt: new Date() },
  });
  return messages;
}

async function getSessionMessages(sessionId: string) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) return [];
  const rawMessages = JSON.parse(session.messages || '[]');
  return rawMessages.map((m: { role: string; content: string }) => ({
    role: m.role, content: m.content,
  }));
}

// POST /api/chat/stream - Streaming chat with SSE
export async function POST(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { issueId, message, agentId, userId } = body;

    if (!issueId || !message) {
      return new Response(JSON.stringify({ error: 'issueId and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch issue context
    const issue = await db.issue.findUnique({
      where: { id: issueId },
      include: {
        creator: { select: { id: true, name: true, type: true } },
        assignee: { select: { id: true, name: true, type: true, systemPrompt: true, capabilities: true } },
      },
    });

    if (!issue) {
      return new Response(JSON.stringify({ error: 'Issue not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const chatAgentId = agentId || issue.assigneeId;
    if (!chatAgentId) {
      return new Response(JSON.stringify({ error: 'No agent assigned' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const agent = await db.member.findUnique({ where: { id: chatAgentId } });
    if (!agent || agent.type !== 'agent') {
      return new Response(JSON.stringify({ error: 'Not an agent' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get or create session
    const session = await getOrCreateSession(chatAgentId, issueId);

    // Save user message
    const humanComment = await db.comment.create({
      data: {
        content: message,
        authorId: userId || issue.creatorId,
        issueId,
        authorType: 'human',
        metadata: JSON.stringify({ sessionId: session.id }),
      },
      include: { author: { select: { id: true, name: true, type: true, avatar: true } } },
    });
    await addMessageToSession(session.id, 'user', message);

    // Build LLM messages
    const capabilities = (() => {
      try { return JSON.parse(agent.capabilities || '[]'); } catch { return []; }
    })();

    const contextSystemMessage = `You are ${agent.name}, an AI agent specializing in: ${Array.isArray(capabilities) ? capabilities.join(', ') : capabilities}.

Current Task Context:
- Title: ${issue.title}
- Description: ${issue.description || 'No description'}
- Status: ${issue.status}
- Priority: ${issue.priority}
- Scene: ${issue.scene || 'general'}

Instructions:
- Be concise, actionable, and professional
- If discussing code, provide specific examples
- Always respond in the same language the user writes in`;

    const sessionMessages = await getSessionMessages(session.id);
    const llmMessages = [
      { role: 'system', content: contextSystemMessage },
      ...sessionMessages.slice(-20),
    ];

    // Create SSE stream
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const ZAI = (await import('z-ai-web-dev-sdk')).default;
          const zai = await ZAI.create();

          // Try streaming first
          try {
            const streamResult = await zai.chat.completions.create({
              messages: llmMessages,
              temperature: 0.7,
              max_tokens: 2000,
              stream: true,
            });

            // Handle different stream response formats
            if (streamResult && typeof streamResult === 'object' && 'pipeTo' in streamResult) {
              const reader = (streamResult as ReadableStream).getReader();
              const decoder = new TextDecoder();

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;
                    try {
                      const parsed = JSON.parse(data);
                      const content = parsed.choices?.[0]?.delta?.content || '';
                      if (content) {
                        fullResponse += content;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`));
                      }
                    } catch {
                      // Skip unparseable lines
                    }
                  }
                }
              }
            } else {
              throw new Error('Stream not supported, falling back');
            }
          } catch {
            // Fallback to non-streaming
            const result = await zai.chat.completions.create({
              messages: llmMessages,
              temperature: 0.7,
              max_tokens: 2000,
            });
            fullResponse = result.choices?.[0]?.message?.content || result.content || result.text || '';

            if (typeof fullResponse !== 'string') {
              fullResponse = JSON.stringify(fullResponse);
            }

            // Simulate streaming by sending chunks
            if (fullResponse) {
              const words = fullResponse.split(/(?<=\s)/);
              for (const word of words) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: word })}\n\n`));
                await new Promise(resolve => setTimeout(resolve, 20));
              }
            }
          }

          if (!fullResponse) {
            fullResponse = `收到你的消息。我是 ${agent.name}，暂时无法生成详细回复。`;
          }

          // Save assistant message to session
          await addMessageToSession(session.id, 'assistant', fullResponse);

          // Create agent comment
          const agentComment = await db.comment.create({
            data: {
              content: fullResponse,
              authorId: chatAgentId,
              issueId,
              authorType: 'agent',
              metadata: JSON.stringify({ isChatResponse: true, sessionId: session.id }),
            },
            include: { author: { select: { id: true, name: true, type: true, avatar: true } } },
          });

          // Audit log
          await createAuditLog({
            actorId: chatAgentId,
            actorType: 'agent',
            action: 'add_comment',
            targetType: 'comment',
            targetId: agentComment.id,
            details: { issueId, isChatResponse: true, sessionId: session.id, streamed: true },
          });

          // Broadcast
          broadcastEvent('comment:added', { commentId: agentComment.id, issueId, authorId: chatAgentId, authorType: 'agent', sessionId: session.id });

          // Send done event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            commentId: agentComment.id,
            sessionId: session.id,
          })}\n\n`));

          controller.close();
        } catch (error) {
          console.error('[chat/stream] Error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[chat/stream] Failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to process stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
