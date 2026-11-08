import type { NextFunction, Request, Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { AppError, forbidden } from '../lib/http.js';
import type { Action, Module, PermissionSet } from '../lib/permissions.js';
import { SESSION_COOKIE, clearSessionCookie, verifySession } from '../lib/session.js';

export type AuthUser = {
  id: number;
  loginId: string;
  email: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN';
  name: string;
  designation: string | null;
  permissions: PermissionSet;
  /** null = all branches (SUPER_ADMIN) */
  branchIds: number[] | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function loadAuthUser(userId: number): Promise<(AuthUser & { tokenVersion: number }) | null> {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.isActive, true), isNull(users.deletedAt)),
    with: { profile: true, permissions: true, branches: true },
  });
  if (!user) return null;
  const permissions: PermissionSet = {};
  for (const p of user.permissions) {
    permissions[p.module] = { view: p.canView, create: p.canCreate, edit: p.canEdit, delete: p.canDelete };
  }
  return {
    id: user.id,
    loginId: user.loginId,
    email: user.email,
    role: user.role,
    name: user.profile?.fullName ?? user.loginId,
    designation: user.profile?.designation ?? null,
    permissions,
    branchIds: user.role === 'SUPER_ADMIN' ? null : user.branches.map((b) => b.branchId),
    tokenVersion: user.tokenVersion,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(new AppError(401, 'Please log in to continue'));
  const payload = verifySession(token);
  if (!payload) {
    clearSessionCookie(res);
    return next(new AppError(401, 'Session expired. Please log in again'));
  }
  const user = await loadAuthUser(Number(payload.sub));
  if (!user || user.tokenVersion !== payload.tv) {
    clearSessionCookie(res);
    return next(new AppError(401, 'Session is no longer valid. Please log in again'));
  }
  const { tokenVersion: _tv, ...authUser } = user;
  req.user = authUser;
  next();
}

export const isSuperAdmin = (user?: AuthUser) => user?.role === 'SUPER_ADMIN';

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!isSuperAdmin(req.user)) return next(forbidden('Only the Super Admin can access this module'));
  next();
}

export function hasPermission(user: AuthUser | undefined, module: Module, action: Action) {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return Boolean(user.permissions[module]?.[action]);
}

export function requirePermission(module: Module, action: Action) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!hasPermission(req.user, module, action)) return next(forbidden());
    next();
  };
}

/** Throws 403 if the admin is not assigned to the given branch. */
export function assertBranchAccess(user: AuthUser | undefined, branchId: number | null | undefined) {
  if (!user) throw new AppError(401, 'Unauthorised');
  if (user.branchIds === null) return;
  if (branchId == null || !user.branchIds.includes(branchId)) {
    throw forbidden('This branch is not assigned to your account');
  }
}

/** Returns the branch ids the user may manage, or null for “all”. */
export const branchScope = (user: AuthUser | undefined) => (user ? user.branchIds : []);
