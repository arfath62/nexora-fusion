import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../auth';
import { isDatabaseConfigured } from '../db';

const DEV_GUEST_TOKEN = 'dev-guest';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    if (!isDatabaseConfigured()) {
      req.auth = {
        sub: DEV_GUEST_TOKEN,
        email: 'guest@nexora.local',
      };
      next();
      return;
    }
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
