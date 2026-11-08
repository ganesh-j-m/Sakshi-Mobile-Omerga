import { Router, type Response } from 'express';
import { and, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { billItems, bills, branches, products, users } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { calcBill, newPublicToken, nextBillNumber, toPaise } from '../../lib/billing.js';
import { escapeLike } from '../../lib/catalog.js';
import { badRequest, notFound, paginate, parse, toId } from '../../lib/http.js';
import { DEFAULT_BILLING, getSetting } from '../../lib/settings.js';
import { sendBillTemplate, whatsappConfigured } from '../../lib/whatsappApi.js';
import { indianMobile, optText, requiredText } from '../../lib/validation.js';
import { assertBranchAccess, requirePermission, type AuthUser } from '../../middleware/auth.js';

const router = Router();

const PAYMENT = ['CASH', 'UPI', 'CARD', 'EMI', 'BANK_TRANSFER', 'MIXED'] as const;

const scope = (user: AuthUser): SQL | undefined =>
  user.branchIds === null ? undefined : inArray(bills.branchId, user.branchIds.length ? user.branchIds : [0]);

/* ─────────────────────────── Settings & helpers ─────────────────────────── */

router.get('/settings', requirePermission('BILLING', 'view'), async (_req, res) => {
  res.json({ billing: await getSetting('billing', DEFAULT_BILLING), whatsappAuto: whatsappConfigured() });
});

/** Autofill customer details from their previous bill. */
router.get('/customer', requirePermission('BILLING', 'create'), async (req, res) => {
  const { mobile } = parse(z.object({ mobile: indianMobile }), req.query);
  const [row] = await db
    .select({
      customerName: bills.customerName,
      customerEmail: bills.customerEmail,
      customerAddress: bills.customerAddress,
      customerGstin: bills.customerGstin,
      billCount: sql<number>`count(*) over ()::int`,
    })
    .from(bills)
    .where(and(eq(bills.customerMobile, mobile), scope(req.user!)))
    .orderBy(desc(bills.billDate))
    .limit(1);
  res.json({ customer: row ?? null });
});

/* ─────────────────────────────── List ─────────────────────────────── */

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  branchId: z.coerce.number().int().positive().optional(),
  status: z.enum(['PAID', 'PARTIAL', 'CANCELLED']).optional(),
  paymentMode: z.enum(PAYMENT).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

function listConditions(user: AuthUser, q: z.infer<typeof listQuery>) {
  const c: (SQL | undefined)[] = [scope(user)];
  if (q.search) {
    const t = `%${escapeLike(q.search)}%`;
    c.push(
      or(
        ilike(bills.billNumber, t),
        ilike(bills.customerName, t),
        ilike(bills.customerMobile, t),
        sql`exists (select 1 from bill_items bi where bi.bill_id = ${bills.id} and bi.serial_number ilike ${t})`,
      ),
    );
  }
  if (q.branchId) c.push(eq(bills.branchId, q.branchId));
  if (q.status) c.push(eq(bills.status, q.status));
  if (q.paymentMode) c.push(eq(bills.paymentMode, q.paymentMode));
  // Dates are interpreted in IST (business time zone)
  if (q.from) c.push(gte(bills.billDate, new Date(`${q.from}T00:00:00+05:30`)));
  if (q.to) c.push(lte(bills.billDate, new Date(`${q.to}T23:59:59.999+05:30`)));
  return and(...c);
}

const listColumns = {
  id: bills.id,
  billNumber: bills.billNumber,
  billDate: bills.billDate,
  customerName: bills.customerName,
  customerMobile: bills.customerMobile,
  totalPaise: bills.totalPaise,
  paidPaise: bills.paidPaise,
  paymentMode: bills.paymentMode,
  status: bills.status,
  whatsappSentAt: bills.whatsappSentAt,
  whatsappStatus: bills.whatsappStatus,
  branchId: bills.branchId,
  branchName: branches.name,
  createdBy: users.loginId,
  itemCount: sql<number>`(select coalesce(sum(quantity),0)::int from bill_items bi where bi.bill_id = ${bills.id})`,
};

router.get('/', requirePermission('BILLING', 'view'), async (req, res) => {
  const q = parse(listQuery, req.query);
  const where = listConditions(req.user!, q);
  const { limit, offset, page } = paginate(q.page, q.limit);
  const [summary] = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalPaise: sql<number>`coalesce(sum(${bills.totalPaise}) filter (where ${bills.status} <> 'CANCELLED'),0)::bigint`,
      paidPaise: sql<number>`coalesce(sum(${bills.paidPaise}) filter (where ${bills.status} <> 'CANCELLED'),0)::bigint`,
      cancelled: sql<number>`count(*) filter (where ${bills.status} = 'CANCELLED')::int`,
    })
    .from(bills)
    .where(where);
  const items = await db
    .select(listColumns)
    .from(bills)
    .innerJoin(branches, eq(bills.branchId, branches.id))
    .leftJoin(users, eq(bills.createdById, users.id))
    .where(where)
    .orderBy(desc(bills.billDate), desc(bills.id))
    .limit(limit)
    .offset(offset);
  res.json({
    items,
    summary: { ...summary, totalPaise: Number(summary.totalPaise), paidPaise: Number(summary.paidPaise) },
    pagination: { page, limit, total: summary.count, totalPages: Math.max(1, Math.ceil(summary.count / limit)) },
  });
});

/* ─────────────────────────────── Export ─────────────────────────────── */

function cell(v: unknown) {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const rs = (p: number) => (p / 100).toFixed(2);

function sendCsv(res: Response, name: string, rows: unknown[][]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send('﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n'));
}

router.get('/export.csv', requirePermission('BILLING', 'view'), async (req, res) => {
  const q = parse(listQuery, req.query);
  const rows = await db
    .select({
      billNumber: bills.billNumber,
      billDate: bills.billDate,
      branch: branches.name,
      customerName: bills.customerName,
      customerMobile: bills.customerMobile,
      customerGstin: bills.customerGstin,
      taxable: bills.taxablePaise,
      cgst: bills.cgstPaise,
      sgst: bills.sgstPaise,
      total: bills.totalPaise,
      paid: bills.paidPaise,
      mode: bills.paymentMode,
      status: bills.status,
      createdBy: users.loginId,
    })
    .from(bills)
    .innerJoin(branches, eq(bills.branchId, branches.id))
    .leftJoin(users, eq(bills.createdById, users.id))
    .where(listConditions(req.user!, q))
    .orderBy(desc(bills.billDate))
    .limit(50000);
  await logActivity(req, 'EXPORT', 'bills', null, { count: rows.length });
  sendCsv(res, `bills-${new Date().toISOString().slice(0, 10)}.csv`, [
    ['Bill No', 'Date', 'Branch', 'Customer', 'Mobile', 'Customer GSTIN', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'Total (₹)', 'Paid (₹)', 'Payment', 'Status', 'Billed by'],
    ...rows.map((r) => [r.billNumber, r.billDate, r.branch, r.customerName, r.customerMobile, r.customerGstin, rs(r.taxable), rs(r.cgst), rs(r.sgst), rs(r.total), rs(r.paid), r.mode, r.status, r.createdBy]),
  ]);
});

/* ─────────────────────────────── Detail ─────────────────────────────── */

export async function loadBill(where: SQL) {
  const bill = await db.query.bills.findFirst({
    where,
    with: {
      items: { orderBy: (t, o) => [o.asc(t.sortOrder), o.asc(t.id)] },
      branch: {
        columns: { id: true, code: true, name: true, addressLine: true, city: true, district: true, state: true, pincode: true, phone: true, email: true },
      },
      createdBy: { columns: { loginId: true } },
    },
  });
  return bill;
}

router.get('/:id', requirePermission('BILLING', 'view'), async (req, res) => {
  const bill = await loadBill(and(eq(bills.id, toId(req.params.id)), scope(req.user!))!);
  if (!bill) throw notFound('Bill');
  res.json({ bill, billing: await getSetting('billing', DEFAULT_BILLING) });
});

/* ─────────────────────────────── Create ─────────────────────────────── */

const money = z.coerce.number().min(0).max(10_000_000);

const createSchema = z.object({
  branchId: z.coerce.number().int().positive('Select a branch'),
  // Only the mobile number is mandatory — name defaults to “Customer”
  customerName: optText(120).transform((v) => (v && v.length >= 2 ? v : 'Customer')),
  customerMobile: indianMobile,
  customerEmail: z.union([z.string().trim().email(), z.literal(''), z.null()]).optional().transform((v) => v || null),
  customerAddress: optText(500),
  customerGstin: z
    .union([z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'Invalid GSTIN'), z.literal(''), z.null()])
    .optional()
    .transform((v) => v || null),
  paymentMode: z.enum(PAYMENT).default('CASH'),
  paymentReference: optText(120),
  /** Amount received in rupees. Omit = full payment. */
  paidAmount: money.optional().nullable(),
  notes: optText(1000),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive().optional().nullable(),
        description: requiredText(250, 2),
        sku: optText(40),
        hsnCode: optText(12),
        serialNumber: optText(120),
        quantity: z.coerce.number().int().min(1).max(999),
        unitPrice: money,
        discount: money.default(0),
        gstRate: z.coerce.number().min(0).max(28),
      }),
    )
    .min(1, 'Add at least one item')
    .max(60),
});

router.post('/', requirePermission('BILLING', 'create'), async (req, res) => {
  const body = parse(createSchema, req.body);
  assertBranchAccess(req.user, body.branchId);

  const branch = await db.query.branches.findFirst({ where: eq(branches.id, body.branchId) });
  if (!branch || branch.deletedAt) throw badRequest('Branch not found', { branchId: 'Invalid branch' });

  // Only link products that really exist
  const pids = body.items.map((i) => i.productId).filter((x): x is number => Boolean(x));
  const known = pids.length
    ? new Map((await db.select({ id: products.id, sku: products.sku }).from(products).where(inArray(products.id, pids))).map((p) => [p.id, p.sku]))
    : new Map<number, string>();

  const settings = await getSetting('billing', DEFAULT_BILLING);
  const lines = body.items.map((i) => ({
    quantity: i.quantity,
    unitPricePaise: toPaise(i.unitPrice),
    discountPaise: Math.min(toPaise(i.discount), toPaise(i.unitPrice) * i.quantity),
    gstRate: i.gstRate,
  }));
  const totals = calcBill(lines, settings.pricesIncludeGst);
  if (totals.totalPaise <= 0) throw badRequest('Bill total must be greater than zero');

  const paid = body.paidAmount == null ? totals.totalPaise : toPaise(body.paidAmount);
  if (paid > totals.totalPaise) throw badRequest('Amount received cannot exceed the bill total', { paidAmount: 'Too high' });

  const created = await db.transaction(async (tx) => {
    const billNumber = await nextBillNumber(tx, branch.id, branch.code, settings.invoicePrefix);
    const [b] = await tx
      .insert(bills)
      .values({
        billNumber,
        publicToken: newPublicToken(),
        branchId: branch.id,
        customerName: body.customerName,
        customerMobile: body.customerMobile,
        customerEmail: body.customerEmail,
        customerAddress: body.customerAddress,
        customerGstin: body.customerGstin,
        pricesIncludeGst: settings.pricesIncludeGst,
        subtotalPaise: totals.subtotalPaise,
        discountPaise: totals.discountPaise,
        taxablePaise: totals.taxablePaise,
        cgstPaise: totals.cgstPaise,
        sgstPaise: totals.sgstPaise,
        roundOffPaise: totals.roundOffPaise,
        totalPaise: totals.totalPaise,
        paidPaise: paid,
        paymentMode: body.paymentMode,
        paymentReference: body.paymentReference,
        status: paid >= totals.totalPaise ? 'PAID' : 'PARTIAL',
        notes: body.notes,
        createdById: req.user!.id,
      })
      .returning({ id: bills.id, billNumber: bills.billNumber });
    await tx.insert(billItems).values(
      body.items.map((i, idx) => ({
        billId: b.id,
        productId: i.productId && known.has(i.productId) ? i.productId : null,
        description: i.description,
        sku: i.sku ?? (i.productId ? known.get(i.productId) ?? null : null),
        hsnCode: i.hsnCode ?? (settings.defaultHsn || null),
        serialNumber: i.serialNumber,
        quantity: i.quantity,
        unitPricePaise: lines[idx].unitPricePaise,
        discountPaise: lines[idx].discountPaise,
        gstRate: i.gstRate,
        taxablePaise: totals.calcs[idx].taxablePaise,
        gstPaise: totals.calcs[idx].gstPaise,
        lineTotalPaise: totals.calcs[idx].lineTotalPaise,
        sortOrder: idx,
      })),
    );
    return b;
  });

  await logActivity(req, 'CREATE', 'bill', created.id, { billNumber: created.billNumber, total: totals.totalPaise / 100 });

  // Send the bill to the customer's WhatsApp automatically (when the Cloud API is configured)
  const whatsapp = whatsappConfigured() ? await autoSendWhatsapp(created.id, settings.businessName) : null;
  res.status(201).json({ id: created.id, billNumber: created.billNumber, whatsapp });
});

/** Sends the bill via WhatsApp Cloud API and records the result on the bill. */
async function autoSendWhatsapp(billId: number, businessName: string) {
  const bill = await db.query.bills.findFirst({ where: eq(bills.id, billId) });
  if (!bill) return { ok: false as const, error: 'Bill not found' };
  const result = await sendBillTemplate({
    mobile10: bill.customerMobile,
    customerName: bill.customerName,
    businessName,
    billNumber: bill.billNumber,
    totalRupees: (bill.totalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    link: `${env.PUBLIC_SITE_URL.replace(/\/$/, '')}/bill/${bill.publicToken}`,
  });
  await db
    .update(bills)
    .set(
      result.ok
        ? { whatsappStatus: 'AUTO_SENT', whatsappMessageId: result.messageId, whatsappSentAt: new Date(), whatsappError: null }
        : { whatsappStatus: 'FAILED', whatsappError: result.error },
    )
    .where(eq(bills.id, billId));
  return result;
}

/* ─────────────────────────────── Actions ─────────────────────────────── */

/** Re-send through the Cloud API (e.g. after a failure). */
router.post('/:id/send-whatsapp', requirePermission('BILLING', 'view'), async (req, res) => {
  const id = toId(req.params.id);
  if (!whatsappConfigured()) throw badRequest('WhatsApp API is not configured on the server');
  const [bill] = await db.select({ id: bills.id, status: bills.status }).from(bills).where(and(eq(bills.id, id), scope(req.user!)));
  if (!bill) throw notFound('Bill');
  if (bill.status === 'CANCELLED') throw badRequest('Cancelled bills cannot be sent');
  const settings = await getSetting('billing', DEFAULT_BILLING);
  const result = await autoSendWhatsapp(id, settings.businessName);
  await logActivity(req, result.ok ? 'WHATSAPP_AUTO_SENT' : 'WHATSAPP_FAILED', 'bill', id, result.ok ? undefined : { error: result.error });
  res.json({ whatsapp: result });
});

/** Staff sent it manually via click-to-chat. */
router.post('/:id/whatsapp-sent', requirePermission('BILLING', 'view'), async (req, res) => {
  const id = toId(req.params.id);
  const [row] = await db
    .update(bills)
    .set({ whatsappSentAt: new Date(), whatsappStatus: 'MANUAL' })
    .where(and(eq(bills.id, id), scope(req.user!)))
    .returning({ id: bills.id });
  if (!row) throw notFound('Bill');
  await logActivity(req, 'WHATSAPP_SENT', 'bill', id);
  res.json({ ok: true });
});

/** Bills are never deleted (audit trail) — they are cancelled with a reason. */
router.post('/:id/cancel', requirePermission('BILLING', 'edit'), async (req, res) => {
  const id = toId(req.params.id);
  const { reason } = parse(z.object({ reason: requiredText(300, 3) }), req.body);
  const [row] = await db
    .update(bills)
    .set({ status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, cancelledById: req.user!.id })
    .where(and(eq(bills.id, id), ne(bills.status, 'CANCELLED'), scope(req.user!)))
    .returning({ id: bills.id, billNumber: bills.billNumber });
  if (!row) throw notFound('Bill (or it is already cancelled)');
  await logActivity(req, 'CANCEL', 'bill', id, { billNumber: row.billNumber, reason });
  res.json({ ok: true });
});

export default router;
