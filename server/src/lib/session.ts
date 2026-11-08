import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';

export const SESSION_COOKIE = 'sm_session';

type SessionPayload = { sub: number; tv: number; role: string };

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${env.SESSION_TTL_HOURS}h`,
    issuer: 'sakshi-mobile',
    audience: 'sakshi-mobile-admin',
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'sakshi-mobile',
      audience: 'sakshi-mobile-admin',
    }) as unknown as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
});

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: env.SESSION_TTL_HOURS * 3600 * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}
