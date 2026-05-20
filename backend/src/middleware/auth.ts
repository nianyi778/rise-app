import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import type { AppEnv } from '../types/index.js';

function getSecret(): string {
  return process.env.JWT_SECRET ?? 'change-me-in-production';
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authorization.slice(7);
  try {
    const payload = jwt.verify(token, getSecret()) as { userId: string };
    c.set('userId', payload.userId);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
});

export function signToken(userId: string): string {
  return jwt.sign({ userId }, getSecret(), { expiresIn: '7d' });
}
