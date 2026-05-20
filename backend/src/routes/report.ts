import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.js';
import { WEEKLY_REPORT_SYSTEM, buildWeeklyReportPrompt } from '../ai/prompts.js';
import type { AppEnv, Goal, User } from '../types/index.js';

interface SessionRow {
  date: string;
  action: string;
  status: string;
  actual_min: number | null;
  mood: string | null;
  note: string | null;
}

interface WeeklyInsight {
  breakthrough: string;
  observation: string;
  nextWeekDirection: string;
}

function getWeekBounds(): { monday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday: monday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10),
  };
}

export const reportRouter = new Hono<AppEnv>();
reportRouter.use('/*', authMiddleware);

// GET /report/weekly
reportRouter.get('/weekly', async (c) => {
  const userId = c.get('userId');

  const [userResult, goalResult] = await Promise.all([
    query<User>(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]),
    query<Goal>(
      `SELECT * FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
  ]);

  if (goalResult.rows.length === 0) return c.json({ error: 'No active goal found' }, 404);

  const user = userResult.rows[0] as User;
  const goal = goalResult.rows[0] as Goal;
  const { monday, sunday } = getWeekBounds();

  const rows = await query<SessionRow>(
    `SELECT s.date::text, s.action, s.status, s.actual_min,
            c.mood, c.note
       FROM sessions s
       LEFT JOIN checkins c ON c.session_id = s.id
      WHERE s.user_id = $1 AND s.goal_id = $2
        AND s.date BETWEEN $3 AND $4
      ORDER BY s.date ASC`,
    [userId, goal.id, monday, sunday],
  );

  const details = rows.rows.map((r) => ({
    date: r.date,
    action: r.action,
    mood: r.mood ?? undefined,
    note: r.note ?? undefined,
  }));

  const completedDays = rows.rows.filter((r) => r.status === 'done').length;
  const startDay =
    Math.floor((new Date(monday).getTime() - new Date(goal.start_date).getTime()) / 86_400_000) + 1;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: WEEKLY_REPORT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: buildWeeklyReportPrompt(user.nickname, goal, {
          weekStartDay: startDay,
          weekEndDay: startDay + 6,
          completedDays,
          details,
        }),
      },
    ],
  });

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}';
  const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  let insight: WeeklyInsight;
  try {
    insight = JSON.parse(jsonStr) as WeeklyInsight;
  } catch {
    insight = { breakthrough: '', observation: text, nextWeekDirection: '' };
  }

  return c.json({
    week: { monday, sunday, completedDays, totalDays: 7 },
    goal,
    sessions: rows.rows,
    insight,
  });
});
