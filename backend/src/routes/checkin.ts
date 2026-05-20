import { Hono } from 'hono';
import { z } from 'zod';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import type { AppEnv, Checkin, Session } from '../types/index.js';

const CheckinSchema = z.object({
  sessionId: z.string().min(1),
  goalId: z.string().min(1),
  mood: z.enum(['hard', 'ok', 'good', 'great']),
  note: z.string().max(500).optional(),
  focusMin: z.number().int().min(1).max(480).default(25),
});

async function calculateStreak(userId: string, goalId: string, today: string): Promise<number> {
  const result = await query<{ date: string }>(
    `SELECT date::text FROM checkins
      WHERE user_id = $1 AND goal_id = $2
      ORDER BY date DESC`,
    [userId, goalId],
  );

  const dateSet = new Set(result.rows.map((r) => r.date));
  let streak = 1; // today counts as 1

  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() - 1);

  while (true) {
    const ds = cursor.toISOString().slice(0, 10);
    if (dateSet.has(ds)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export const checkinRouter = new Hono<AppEnv>();
checkinRouter.use('/*', authMiddleware);

// POST /checkin
checkinRouter.post('/', async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = CheckinSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);

  const { sessionId, goalId, mood, note, focusMin } = parsed.data;

  // Verify session ownership
  const sessionResult = await query<Session>(
    `SELECT * FROM sessions WHERE id = $1 AND user_id = $2 AND goal_id = $3 LIMIT 1`,
    [sessionId, userId, goalId],
  );
  const session = sessionResult.rows[0];
  if (!session) return c.json({ error: 'Session not found' }, 404);
  if (session.status === 'done') return c.json({ error: 'Session already checked in' }, 409);

  const checkinDate = session.date.toString().slice(0, 10);

  // Streak uses session.date (not necessarily today)
  const streakDay = await calculateStreak(userId, goalId, checkinDate);

  // Previous max streak for new-record detection
  const maxResult = await query<{ max_streak: string }>(
    `SELECT COALESCE(MAX(streak_day), 0)::text as max_streak
       FROM checkins WHERE user_id = $1 AND goal_id = $2`,
    [userId, goalId],
  );
  const prevMax = parseInt(maxResult.rows[0]?.max_streak ?? '0', 10);
  const isNewRecord = streakDay > prevMax;

  const checkinResult = await query<Checkin>(
    `INSERT INTO checkins (user_id, session_id, goal_id, date, mood, note, focus_min, streak_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, sessionId, goalId, checkinDate, mood, note ?? null, focusMin, streakDay],
  );

  await query(
    `UPDATE sessions SET status = 'done', actual_min = $1 WHERE id = $2`,
    [focusMin, sessionId],
  );

  return c.json({ checkin: checkinResult.rows[0], streakDay, isNewRecord }, 201);
});

// GET /checkin/today — convenience endpoint for home page
checkinRouter.get('/today', async (c) => {
  const userId = c.get('userId');
  const today = new Date().toISOString().slice(0, 10);
  const result = await query<Checkin & { action: string }>(
    `SELECT c.*, s.action
       FROM checkins c
       JOIN sessions s ON s.id = c.session_id
      WHERE c.user_id = $1 AND c.date = $2
      ORDER BY c.created_at DESC`,
    [userId, today],
  );
  return c.json({ checkins: result.rows });
});
