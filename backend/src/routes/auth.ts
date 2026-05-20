import { Hono } from 'hono';
import { z } from 'zod';
import { query } from '../db/client.js';
import { signToken } from '../middleware/auth.js';
import type { AppEnv, User } from '../types/index.js';

const LoginSchema = z.object({
  code: z.string().min(1, 'code is required'),
  nickname: z.string().optional(),
  avatar: z.string().url().optional(),
});

interface WxSessionResponse {
  openid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

async function wxCode2Session(code: string): Promise<{ openid: string }> {
  const appid = process.env.WX_APPID;
  const secret = process.env.WX_SECRET;
  if (!appid || !secret) {
    throw new Error('WX_APPID and WX_SECRET must be set');
  }

  const url =
    `https://api.weixin.qq.com/sns/jscode2session` +
    `?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

  const res = await fetch(url);
  const data = (await res.json()) as WxSessionResponse;

  if (data.errcode || !data.openid) {
    throw new Error(`WeChat auth failed: ${data.errmsg ?? 'unknown error'} (code ${data.errcode ?? 0})`);
  }
  return { openid: data.openid };
}

export const authRouter = new Hono<AppEnv>();

authRouter.post('/login', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.issues }, 400);
  }
  const { code, nickname, avatar } = parsed.data;

  const { openid } = await wxCode2Session(code);

  const result = await query<User>(
    `INSERT INTO users (id, nickname, avatar)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE
       SET nickname = COALESCE($2, users.nickname),
           avatar   = COALESCE($3, users.avatar)
     RETURNING *`,
    [openid, nickname ?? null, avatar ?? null]
  );

  const user = result.rows[0];
  const token = signToken(openid);

  return c.json({ token, user }, 200);
});
