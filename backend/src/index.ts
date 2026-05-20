import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { authRouter } from './routes/auth.js';
import { goalsRouter } from './routes/goals.js';
import { checkinRouter } from './routes/checkin.js';
import { aiRouter } from './routes/ai.js';
import { reportRouter } from './routes/report.js';
import type { AppEnv } from './types/index.js';

const app = new Hono<AppEnv>();

app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86_400,
  }),
);

app.route('/auth', authRouter);
app.route('/goals', goalsRouter);
app.route('/checkin', checkinRouter);
app.route('/ai', aiRouter);
app.route('/report', reportRouter);

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.onError((err, c) => {
  console.error('[ERROR]', err);
  // Use 500 as safe fallback; Hono's HTTPException already sets the right status
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`Rise API running on :${port}`);
});

export default app;
