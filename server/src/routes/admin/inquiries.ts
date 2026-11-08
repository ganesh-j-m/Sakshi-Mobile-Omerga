import { Router } from 'express';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { branches, inquiries, offers, products, users } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { escapeLike } from '../../lib/catalog.js';
import { forbidden, notFound, paginate, parse, toId } from '../../lib/http.js';
import { requiredText } from '../../lib/validation.js';
import { isSuperAdmin, requirePermission, requireSuperAdmin, type AuthUser } from '../../middleware/auth.js';

const router = Router();

export const INQUIRY_STATUS = ['NEW', 'CONTACTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const INQUIRY_TYPES = ['PRODUCT', 'BRANCH', 'OFFER', 'GENERAL', 'EXCHANGE', 'EMI'] as const;

/** Admins see inquiries for their branches plus general (no-branch) inquiries. */
export function inquiryScope(user: AuthUser): SQL | undefined {
  if (user.branchIds === null) return undefined;
  return or(isNull(inquiries.branchId), inArray(inquiries.branchId, user.branchIds.length ? user.branchIds : [0]));
}

export const inquiryFilters = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(INQUIRY_STATUS).optional(),
  type: z.enum(INQUIRY_TYPES).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function inquiryConditions(user: AuthUser, q: z.infer<typeof inquiryFilters>) {
  const conds: (SQL | undefined)[] = [inquiryScope(user)];
  if (q.search) {
    const term = `%${escapeLike(q.search)}%`;
    conds.push(or(ilike(inquiries.customerName, term), ilike(inquiries.mobile, term), ilike(inquiries.email, term), ilike(inquiries.message, term)));
  }
  if (q.status) conds.push(eq(inquiries.status, q.status));
  if (q.type) conds.push(eq(inquiries.type, q.type));
  if (q.branchId) conds.push(eq(inquiries.branchId, q.branchId));
  if (q.from) conds.push(gte(inquiries.createdAt, new Date(`${q.from}T00:00:00`)));
  if (q.to) conds.push(lte(inquiries.createdAt, new Date(`${q.to}T23:59:59.999`)));
  return and(...conds);
}

export const inquiryColumns = {
  id: inquiries.id,
  customerName: inquiries.customerName,
  mobile: inquiries.mobile,
  email: inquiries.email,
  type: inquiries.type,
  status: inquiries.status,
  message: inquiries.message,
  remarks: inquiries.remarks,
  createdAt: inquiries.createdAt,
  updatedAt: inquiries.updatedAt,
  contactedAt: inquiries.contactedAt,
  resolvedAt: inquiries.resolvedAt,
  branchId: inquiries.branchId,
  branchName: branches.name,
  productId: inquiries.productId,
  productName: products.name,
  productSlug: products.slug,
  offerTitle: offers.title,
  handledBy: users.loginId,
};

export const inquiryQuery = () =>
  db
    .select(inquiryColumns)
    .from(inquiries)
    .leftJoin(branches, eq(inquiries.branchId, branches.id))
    .leftJoin(products, eq(inquiries.productId, products.id))
    .leftJoin(offers, eq(inquiries.offerId, offers.id))
    .leftJoin(users, eq(inquiries.handledById, users.id));

router.get('/', requirePermission('INQUIRIES', 'view'), async (req, res) => {
  const q = parse(inquiryFilters, req.query);
  const where = inquiryConditions(req.user!, q);
  const { limit, offset, page } = paginate(q.page, q.limit);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(inquiries).where(where);
  const items = await inquiryQuery().where(where).orderBy(desc(inquiries.createdAt)).limit(limit).offset(offset);
  const counts = await db
    .select({ status: inquiries.status, count: sql<number>`count(*)::int` })
    .from(inquiries)
    .where(inquiryScope(req.user!))
    .groupBy(inquiries.status);
  res.json({
    items,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.count])),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

async function loadScoped(user: AuthUser, id: number) {
  const [row] = await inquiryQuery().where(and(eq(inquiries.id, id), inquiryScope(user)));
  if (!row) throw notFound('Inquiry');
  return row;
}

router.get('/:id', requirePermission('INQUIRIES', 'view'), async (req, res) => {
  res.json({ item: await loadScoped(req.user!, toId(req.params.id)) });
});

router.patch('/:id/status', requirePermission('INQUIRIES', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  const current = await loadScoped(req.user!, id);
  const { status, note } = parse(
    z.object({ status: z.enum(INQUIRY_STATUS), note: z.string().trim().max(1000).optional() }),
    req.body,
  );
  const now = new Date();
  const remarks = [...current.remarks];
  remarks.push({ by: req.user!.name, at: now.toISOString(), note: note ? `[${status}] ${note}` : `Status changed to ${status}` });
  await db
    .update(inquiries)
    .set({
      status,
      remarks,
      handledById: req.user!.id,
      contactedAt: status === 'CONTACTED' && !current.contactedAt ? now : undefined,
      resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? (current.resolvedAt ?? now) : null,
    })
    .where(eq(inquiries.id, id));
  await logActivity(req, 'STATUS_CHANGE', 'inquiry', id, { from: current.status, to: status });
  res.json({ item: await loadScoped(req.user!, id) });
});

router.post('/:id/remarks', requirePermission('INQUIRIES', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  const current = await loadScoped(req.user!, id);
  const { note } = parse(z.object({ note: requiredText(1000, 2) }), req.body);
  await db
    .update(inquiries)
    .set({
      remarks: [...current.remarks, { by: req.user!.name, at: new Date().toISOString(), note }],
      handledById: req.user!.id,
    })
    .where(eq(inquiries.id, id));
  await logActivity(req, 'REMARK', 'inquiry', id);
  res.json({ item: await loadScoped(req.user!, id) });
});

router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const id = toId(req.params.id);
  if (!isSuperAdmin(req.user)) throw forbidden();
  const result = await db.delete(inquiries).where(eq(inquiries.id, id)).returning({ id: inquiries.id });
  if (!result.length) throw notFound('Inquiry');
  await logActivity(req, 'DELETE', 'inquiry', id);
  res.json({ ok: true });
});

export default router;
