import { Router, type Response } from 'express';
import { asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { idList } from '../../lib/catalog.js';
import { brands, categories, inquiries, products } from '../../db/schema.js';
import { logActivity } from '../../lib/activity.js';
import { parse } from '../../lib/http.js';
import { requirePermission } from '../../middleware/auth.js';
import { inquiryConditions, inquiryFilters, inquiryQuery } from './inquiries.js';

const router = Router();

/** CSV cell escaping + spreadsheet formula-injection guard. */
function cell(v: unknown): string {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sendCsv(res: Response, filename: string, header: string[], rows: unknown[][]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'));
}

const rangeSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

router.get('/summary', requirePermission('REPORTS', 'view'), async (req, res) => {
  const { from, to } = parse(rangeSchema, req.query);
  const ids = req.user!.branchIds;
  const scope =
    ids === null ? sql`true` : sql`(i.branch_id is null or i.branch_id in ${idList(ids.length ? ids : [0])})`;
  const fromDate = from ?? new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const toDate = to ?? new Date().toISOString().slice(0, 10);
  const range = sql`i.created_at >= ${fromDate}::date and i.created_at < (${toDate}::date + interval '1 day')`;

  const [overview] = (
    await db.execute<{ total: number; resolved: number; open: number; avg_hours_to_contact: number | null }>(sql`
      select count(*)::int as total,
        count(*) filter (where status in ('RESOLVED','CLOSED'))::int as resolved,
        count(*) filter (where status in ('NEW','CONTACTED','IN_PROGRESS'))::int as open,
        round(avg(extract(epoch from (contacted_at - created_at)) / 3600)::numeric, 1)::float as avg_hours_to_contact
      from inquiries i where ${scope} and ${range}`)
  ).rows;

  const byBranch = (
    await db.execute<{ branch: string; total: number; resolved: number }>(sql`
      select coalesce(b.name, 'General / No branch') as branch, count(*)::int as total,
        count(*) filter (where i.status in ('RESOLVED','CLOSED'))::int as resolved
      from inquiries i left join branches b on b.id = i.branch_id
      where ${scope} and ${range} group by b.name order by total desc`)
  ).rows;

  const byType = (
    await db.execute<{ type: string; count: number }>(sql`
      select i.type, count(*)::int as count from inquiries i where ${scope} and ${range} group by i.type order by count desc`)
  ).rows;

  const topProducts = (
    await db.execute<{ product: string; count: number }>(sql`
      select p.name as product, count(*)::int as count
      from inquiries i join products p on p.id = i.product_id
      where ${scope} and ${range} group by p.name order by count desc limit 10`)
  ).rows;

  const stock = (
    await db.execute<{ status: string; count: number }>(sql`
      select stock_status as status, count(*)::int as count from products where deleted_at is null group by stock_status`)
  ).rows;

  const byCategory = (
    await db.execute<{ category: string; count: number }>(sql`
      select c.name as category, count(p.id)::int as count
      from categories c left join products p on p.category_id = c.id and p.deleted_at is null
      where c.deleted_at is null group by c.name, c.sort_order order by c.sort_order`)
  ).rows;

  res.json({ range: { from: fromDate, to: toDate }, overview, byBranch, byType, topProducts, stock, byCategory });
});

router.get('/inquiries.csv', requirePermission('REPORTS', 'view'), async (req, res) => {
  const q = parse(inquiryFilters, req.query);
  const rows = await inquiryQuery().where(inquiryConditions(req.user!, q)).orderBy(desc(inquiries.createdAt)).limit(20000);
  await logActivity(req, 'EXPORT', 'inquiries', null, { count: rows.length });
  sendCsv(
    res,
    `inquiries-${new Date().toISOString().slice(0, 10)}.csv`,
    ['ID', 'Date', 'Customer', 'Mobile', 'Email', 'Type', 'Status', 'Branch', 'Product', 'Offer', 'Message', 'Handled By', 'Last Remark'],
    rows.map((r) => [
      r.id,
      r.createdAt,
      r.customerName,
      r.mobile,
      r.email,
      r.type,
      r.status,
      r.branchName,
      r.productName,
      r.offerTitle,
      r.message,
      r.handledBy,
      r.remarks.at(-1)?.note,
    ]),
  );
});

router.get('/products.csv', requirePermission('REPORTS', 'view'), async (req, res) => {
  const rows = await db
    .select({
      sku: products.sku,
      name: products.name,
      brand: brands.name,
      category: categories.name,
      mrp: products.mrp,
      sellingPrice: products.sellingPrice,
      offerPrice: products.offerPrice,
      ram: products.ramGb,
      storage: products.storageGb,
      stock: products.stockStatus,
      featured: products.isFeatured,
      active: products.isActive,
      demo: products.isDemo,
      branches: sql<string>`(select string_agg(b.name || ' (' || bp.stock_status || ')', '; ') from branch_products bp join branches b on b.id = bp.branch_id where bp.product_id = ${products.id})`,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(isNull(products.deletedAt))
    .orderBy(asc(brands.name), asc(products.name));
  await logActivity(req, 'EXPORT', 'products', null, { count: rows.length });
  sendCsv(
    res,
    `products-${new Date().toISOString().slice(0, 10)}.csv`,
    ['SKU', 'Name', 'Brand', 'Category', 'MRP', 'Selling Price', 'Offer Price', 'RAM (GB)', 'Storage (GB)', 'Stock', 'Featured', 'Active', 'Demo', 'Branch Availability'],
    rows.map((r) => Object.values(r)),
  );
});

export default router;
