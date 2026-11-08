import type { Request } from 'express';
import { db } from '../db/index.js';
import { activityLogs } from '../db/schema.js';

export async function logActivity(
  req: Request,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: Record<string, unknown>,
) {
  try {
    await db.insert(activityLogs).values({
      userId: req.user?.id ?? null,
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      details: details ?? null,
      ipAddress: req.ip?.slice(0, 64) ?? null,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    });
  } catch (err) {
    // Logging must never break the request
    console.error('activity log failed', err);
  }
}
