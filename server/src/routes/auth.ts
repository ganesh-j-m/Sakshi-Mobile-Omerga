import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { logActivity } from '../lib/activity.js';
import { AppError, parse } from '../lib/http.js';
import { hashPassword, passwordSchema, verifyPassword } from '../lib/password.js';
import { clearSessionCookie, setSessionCookie, signSession } from '../lib/session.js';
import { loadAuthUser, requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/security.js';

const router = Router();

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Used to keep response timing similar when the login id does not exist
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 12);

const loginSchema = z.object({
  loginId: z.string().trim().min(3).max(64),
  password: z.string().min(1).max(128),
});

router.post('/login', loginLimiter, async (req, res) => {
  const { loginId, password } = parse(loginSchema, req.body);
  const user = await db.query.users.findFirst({
    where: and(eq(sql`lower(${users.loginId})`, loginId.toLowerCase()), isNull(users.deletedAt)),
  });

  const invalid = new AppError(401, 'Invalid Login ID or password');
  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(423, 'Account temporarily locked after repeated failed attempts. Try again later.');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const attempts = user.failedLoginAttempts + 1;
    await db
      .update(users)
      .set({
        failedLoginAttempts: attempts >= MAX_FAILED ? 0 : attempts,
        lockedUntil: attempts >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    await logActivity(req, 'LOGIN_FAILED', 'auth', user.id);
    throw invalid;
  }
  if (!user.isActive) throw new AppError(403, 'This account has been deactivated. Contact the Super Admin.');

  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  const token = signSession({ sub: user.id, tv: user.tokenVersion, role: user.role });
  setSessionCookie(res, token);

  const authUser = await loadAuthUser(user.id);
  req.user = authUser ?? undefined;
  await logActivity(req, 'LOGIN', 'auth', user.id);
  const { tokenVersion: _tv, ...safe } = authUser!;
  res.json({
    user: safe,
    redirectTo: user.role === 'SUPER_ADMIN' ? '/super-admin' : '/admin',
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  await logActivity(req, 'LOGOUT', 'auth', req.user?.id);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: passwordSchema })
  .refine((v) => v.currentPassword !== v.newPassword, { message: 'New password must differ', path: ['newPassword'] });

router.post('/change-password', requireAuth, async (req, res) => {
  const body = parse(changePasswordSchema, req.body);
  const user = await db.query.users.findFirst({ where: eq(users.id, req.user!.id) });
  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw new AppError(400, 'Current password is incorrect', { currentPassword: 'Incorrect password' });
  }
  const newVersion = user.tokenVersion + 1;
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(body.newPassword), tokenVersion: newVersion })
    .where(eq(users.id, user.id));
  // Re-issue session so the current device stays logged in, all others are signed out
  setSessionCookie(res, signSession({ sub: user.id, tv: newVersion, role: user.role }));
  await logActivity(req, 'PASSWORD_CHANGED', 'auth', user.id);
  res.json({ ok: true });
});

export default router;
