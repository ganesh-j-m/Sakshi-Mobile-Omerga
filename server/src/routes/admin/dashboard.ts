import { Router } from 'express';
import { desc, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { idList } from '../../lib/catalog.js';
import { activityLogs, inquiries } from '../../db/schema.js';
import { isSuperAdmin } from '../../middleware/auth.js';
import { inquiryQuery, inquiryScope } from './inquiries.js';

const router = Router();

router.get('/', async (req, res) => {
  const user = req.user!;
  const scope = user.branchIds; // null = all
  const ids = scope === null ? null : scope.length ? scope : [0];
  const branchFilter = ids === null ? sql`true` : sql`b.id in ${idList(ids)}`;
  const billFilter = ids === null ? sql`true` : sql`b2.branch_id in ${idList(ids)}`;
  const inquiryFilter = ids === null ? sql`true` : sql`(i.branch_id is null or i.branch_id in ${idList(ids)})`;

  const [totals] = (
    await db.execute<{
      total_products: number;
      total_brands: number;
      total_branches: number;
      active_offers: number;
      total_inquiries: number;
      new_inquiries: number;
      out_of_stock: number;
      low_stock: number;
      total_admins: number;
      bills_today: number;
      sales_today: number;
      sales_month: number;
    }>(sql`
      select
        (select count(*)::int from products where deleted_at is null) as total_products,
        (select count(*)::int from brands where deleted_at is null) as total_brands,
        (select count(*)::int from branches b where deleted_at is null and ${branchFilter}) as total_branches,
        (select count(*)::int from offers where deleted_at is null and is_active and (valid_to is null or valid_to >= now())) as active_offers,
        (select count(*)::int from inquiries i where ${inquiryFilter}) as total_inquiries,
        (select count(*)::int from inquiries i where i.status = 'NEW' and ${inquiryFilter}) as new_inquiries,
        (select count(*)::int from products where deleted_at is null and stock_status = 'OUT_OF_STOCK') as out_of_stock,
        (select count(*)::int from products where deleted_at is null and stock_status = 'LOW_STOCK') as low_stock,
        (select count(*)::int from users where deleted_at is null and role = 'ADMIN') as total_admins,
        (select count(*)::int from bills b2 where b2.status <> 'CANCELLED' and (b2.bill_date at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date and ${billFilter}) as bills_today,
        (select coalesce(sum(total_paise),0)::bigint from bills b2 where b2.status <> 'CANCELLED' and (b2.bill_date at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date and ${billFilter}) as sales_today,
        (select coalesce(sum(total_paise),0)::bigint from bills b2 where b2.status <> 'CANCELLED' and date_trunc('month', b2.bill_date at time zone 'Asia/Kolkata') = date_trunc('month', now() at time zone 'Asia/Kolkata') and ${billFilter}) as sales_month`)
  ).rows;

  const branchAvailability = (
    await db.execute<{ branch: string; total: number; in_stock: number; low_stock: number; out_of_stock: number }>(sql`
      select b.name as branch,
        count(bp.id)::int as total,
        count(bp.id) filter (where bp.stock_status = 'IN_STOCK')::int as in_stock,
        count(bp.id) filter (where bp.stock_status = 'LOW_STOCK')::int as low_stock,
        count(bp.id) filter (where bp.stock_status = 'OUT_OF_STOCK')::int as out_of_stock
      from branches b
      left join branch_products bp on bp.branch_id = b.id
      where b.deleted_at is null and ${branchFilter}
      group by b.id, b.name, b.sort_order
      order by b.sort_order, b.name`)
  ).rows;

  const inquiriesByDay = (
    await db.execute<{ day: string; count: number }>(sql`
      select to_char(d::date, 'YYYY-MM-DD') as day,
        (select count(*)::int from inquiries i where i.created_at::date = d::date and ${inquiryFilter}) as count
      from generate_series(current_date - interval '29 days', current_date, interval '1 day') d
      order by d`)
  ).rows;

  const byType = (
    await db.execute<{ type: string; count: number }>(sql`
      select i.type, count(*)::int as count from inquiries i where ${inquiryFilter} group by i.type order by count desc`)
  ).rows;

  const byStatus = (
    await db.execute<{ status: string; count: number }>(sql`
      select i.status, count(*)::int as count from inquiries i where ${inquiryFilter} group by i.status`)
  ).rows;

  const productsByBrand = (
    await db.execute<{ brand: string; count: number }>(sql`
      select br.name as brand, count(p.id)::int as count
      from brands br left join products p on p.brand_id = br.id and p.deleted_at is null
      where br.deleted_at is null
      group by br.id, br.name order by count desc, br.name limit 12`)
  ).rows;

  const recentInquiries = await inquiryQuery().where(inquiryScope(user)).orderBy(desc(inquiries.createdAt)).limit(6);

  const recentActivity = isSuperAdmin(user)
    ? await db.query.activityLogs.findMany({
        orderBy: [desc(activityLogs.createdAt)],
        limit: 8,
        with: { user: { columns: { loginId: true } } },
      })
    : [];

  res.json({
    totals: { ...totals, sales_today: Number(totals.sales_today), sales_month: Number(totals.sales_month) },
    branchAvailability,
    inquiriesByDay,
    inquiriesByType: byType,
    inquiriesByStatus: byStatus,
    productsByBrand,
    recentInquiries,
    recentActivity,
  });
});

export default router;
