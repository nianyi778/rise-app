import { Hono } from 'hono';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  GOAL_PLAN_SYSTEM,
  buildGoalPlanPrompt,
  DAILY_ACTION_SYSTEM,
  buildDailyActionPrompt,
} from '../ai/prompts.js';
import type { AppEnv, AiPlan, Checkin, Goal, Session } from '../types/index.js';

const CreateGoalSchema = z.object({
  category: z.enum(['work', 'health', 'learn', 'fin', 'create', 'relate', 'custom']),
  rawInput: z.string().min(5).max(500),
  blocker: z.enum(['no_time', 'no_start', 'interrupted', 'fear']).optional(),
  availableTime: z.string().optional(),
  dailyMinutes: z.number().int().min(5).max(120).default(25),
  preferTime: z.string().regex(/^\d{2}:\d{2}$/).default('21:00'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const UpdateGoalSchema = z.object({
  status: z.enum(['active', 'paused', 'completed', 'archived']),
});

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseAiJson(text: string): AiPlan {
  const clean = text.trim();
  // Try extracting from code block first, then bare JSON
  const inner = clean.match(/```(?:json)?\s*([\s\S]+?)\s*```/)?.[1] ?? clean;
  const obj = inner.match(/\{[\s\S]*\}/)?.[0] ?? inner;
  return JSON.parse(obj) as AiPlan;
}

async function generateGoalPlan(
  rawInput: string,
  blocker: string | undefined,
  availableTime: string | undefined,
  dailyMinutes: number,
): Promise<AiPlan> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: GOAL_PLAN_SYSTEM,
    messages: [
      { role: 'user', content: buildGoalPlanPrompt(rawInput, blocker, availableTime, dailyMinutes) },
    ],
  });
  const block = msg.content[0];
  if (!block || block.type !== 'text') throw new Error('AI returned unexpected response type');
  return parseAiJson(block.text);
}

async function generateDailyAction(
  goal: Pick<Goal, 'title' | 'phase_name' | 'phase_target' | 'daily_minutes'>,
  dayIndex: number,
  yesterdayCheckin: (Pick<Checkin, 'mood'> & { action?: string }) | null,
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: DAILY_ACTION_SYSTEM,
    messages: [
      { role: 'user', content: buildDailyActionPrompt(goal, dayIndex, yesterdayCheckin) },
    ],
  });
  const block = msg.content[0];
  if (!block || block.type !== 'text') return '完成今日目标行动';
  return block.text.trim() || '完成今日目标行动';
}

async function getOrCreateSession(
  goal: Goal,
  userId: string,
  targetDate: string,
): Promise<Session> {
  // Return existing session if already generated
  const existing = await query<Session>(
    `SELECT * FROM sessions WHERE goal_id = $1 AND date = $2 LIMIT 1`,
    [goal.id, targetDate],
  );
  if (existing.rows.length > 0) return existing.rows[0] as Session;

  // Calculate day index
  const startMs = new Date(goal.start_date).getTime();
  const targetMs = new Date(targetDate).getTime();
  const dayIndex = Math.floor((targetMs - startMs) / 86_400_000) + 1;

  // Look up yesterday's completed session + checkin for context
  const yesterday = new Date(targetDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const ctxResult = await query<Checkin & { action: string }>(
    `SELECT c.mood, c.note, s.action
       FROM checkins c
       JOIN sessions s ON s.id = c.session_id
      WHERE c.goal_id = $1 AND c.date = $2
      LIMIT 1`,
    [goal.id, yesterdayStr],
  );
  const yesterdayCtx = ctxResult.rows[0] ?? null;

  const action = await generateDailyAction(goal, dayIndex, yesterdayCtx);

  const result = await query<Session>(
    `INSERT INTO sessions (user_id, goal_id, date, day_index, action, estimated_min)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (goal_id, date) DO UPDATE SET action = EXCLUDED.action
     RETURNING *`,
    [userId, goal.id, targetDate, dayIndex, action, goal.daily_minutes],
  );
  return result.rows[0] as Session;
}

export const goalsRouter = new Hono<AppEnv>();
goalsRouter.use('/*', authMiddleware);

// GET /goals
goalsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const result = await query<Goal>(
    `SELECT * FROM goals WHERE user_id = $1 AND status != 'archived' ORDER BY created_at DESC`,
    [userId],
  );
  return c.json({ goals: result.rows });
});

// POST /goals — create goal + AI plan + first session
goalsRouter.post('/', async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = CreateGoalSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);

  const { category, rawInput, blocker, availableTime, dailyMinutes, preferTime, startDate } = parsed.data;

  // Free plan: max 1 active goal
  const [countRow, userRow] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM goals WHERE user_id = $1 AND status = 'active'`,
      [userId],
    ),
    query<{ plan: string }>(`SELECT plan FROM users WHERE id = $1`, [userId]),
  ]);
  const userPlan = userRow.rows[0]?.plan ?? 'free';
  if (userPlan === 'free' && parseInt(countRow.rows[0]?.count ?? '0', 10) >= 1) {
    return c.json({ error: 'Free plan supports 1 active goal. Upgrade to Pro for more.' }, 403);
  }

  const aiPlan = await generateGoalPlan(rawInput, blocker, availableTime, dailyMinutes);
  const resolvedStart = startDate ?? todayStr();

  const goalResult = await query<Goal>(
    `INSERT INTO goals
       (user_id, title, category, raw_input, blocker,
        phase_name, phase_target, phase_duration_days,
        daily_minutes, prefer_time, start_date, ai_plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      userId,
      aiPlan.goalTitle,
      category,
      rawInput,
      blocker ?? null,
      aiPlan.phase.name,
      aiPlan.phase.target,
      aiPlan.phase.durationDays,
      aiPlan.dailyMinutes ?? dailyMinutes,
      aiPlan.recommendTime ?? preferTime,
      resolvedStart,
      JSON.stringify(aiPlan),
    ],
  );
  const goal = goalResult.rows[0] as Goal;

  await query(`UPDATE users SET onboarded = true WHERE id = $1`, [userId]);

  const session = await getOrCreateSession(goal, userId, resolvedStart);

  return c.json({ goal, session }, 201);
});

// GET /goals/:id/session — get or generate today's session
goalsRouter.get('/:id/session', async (c) => {
  const userId = c.get('userId');
  const goalId = c.req.param('id');
  const today = todayStr();

  const goalResult = await query<Goal>(
    `SELECT * FROM goals WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [goalId, userId],
  );
  if (goalResult.rows.length === 0) return c.json({ error: 'Goal not found' }, 404);
  const goal = goalResult.rows[0] as Goal;

  const session = await getOrCreateSession(goal, userId, today);
  return c.json({ session });
});

// PUT /goals/:id
goalsRouter.put('/:id', async (c) => {
  const userId = c.get('userId');
  const goalId = c.req.param('id');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = UpdateGoalSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);

  const result = await query<Goal>(
    `UPDATE goals SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [parsed.data.status, goalId, userId],
  );
  if (result.rows.length === 0) return c.json({ error: 'Goal not found' }, 404);
  return c.json({ goal: result.rows[0] });
});
