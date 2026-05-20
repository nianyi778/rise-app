import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { REFLECTION_SYSTEM, buildReflectionPrompt } from '../ai/prompts.js';
import type { AppEnv, Checkin, Goal } from '../types/index.js';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

const ChatSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
  goalId: z.string().min(1),
  checkinId: z.string().optional(),
});

export const aiRouter = new Hono<AppEnv>();
aiRouter.use('/*', authMiddleware);

// POST /ai/chat — SSE streaming reflection conversation
aiRouter.post('/chat', async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = ChatSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);

  const { messages, goalId, checkinId } = parsed.data;

  const goalResult = await query<Goal>(
    `SELECT * FROM goals WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [goalId, userId],
  );
  if (goalResult.rows.length === 0) return c.json({ error: 'Goal not found' }, 404);
  const goal = goalResult.rows[0] as Goal;

  // Load checkin context if provided
  let checkin: Pick<Checkin, 'mood' | 'note'> = { mood: 'ok', note: null };
  if (checkinId) {
    const cr = await query<Pick<Checkin, 'mood' | 'note'>>(
      `SELECT mood, note FROM checkins WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [checkinId, userId],
    );
    if (cr.rows[0]) checkin = cr.rows[0];
  }

  // Build system prompt with context; pass prior turns via messages history
  const historyForContext = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const systemWithContext = REFLECTION_SYSTEM + '\n\n' + buildReflectionPrompt(historyForContext, goal, checkin);

  const lastUserMsg = messages[messages.length - 1];
  if (!lastUserMsg) return c.json({ error: 'No message provided' }, 400);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  return streamText(c, async (stream) => {
    const aiStream = anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemWithContext,
      // Pass full conversation so Claude can see the thread
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const chunk of aiStream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        await stream.write(chunk.delta.text);
      }
    }
  });
});
