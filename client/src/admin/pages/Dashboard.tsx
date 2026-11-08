import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, IndianRupee, Receipt, Inbox, PackageX, Smartphone, Tag, Tags, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageLoader } from '@/components/ui';
import { useAuth } from '@/context/auth';
import { get } from '@/lib/api';
import { INQUIRY_STATUS_META, INQUIRY_TYPE_LABEL, rs, timeAgo } from '@/lib/format';
import type { Inquiry, InquiryStatus, InquiryType } from '@/types';
import { AdminPage, Panel, StatCard } from '../components';

type Stats = {
  totals: {
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
  };
  branchAvailability: { branch: string; total: number; in_stock: number; low_stock: number; out_of_stock: number }[];
  inquiriesByDay: { day: string; count: number }[];
  inquiriesByType: { type: InquiryType; count: number }[];
  inquiriesByStatus: { status: InquiryStatus; count: number }[];
  productsByBrand: { brand: string; count: number }[];
  recentInquiries: Inquiry[];
  recentActivity: { id: number; action: string; entity: string; entityId: string | null; createdAt: string; user: { loginId: string } | null }[];
};

const PIE = ['#2563FF', '#7C3AED', '#FF7A18', '#10B981', '#F43F5E', '#0EA5E9'];

export default function Dashboard({ base }: { base: string }) {
  const { isSuper, can } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => get<Stats>('/admin/dashboard'), refetchInterval: 60_000 });
  if (isLoading || !data) return <PageLoader />;
  const t = data.totals;

  return (
    <AdminPage title={isSuper ? 'Super Admin Dashboard' : 'Admin Dashboard'} subtitle="Live statistics calculated from the database">
      {can('BILLING') && (
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <StatCard label="Today's sales" value={rs(t.sales_today)} Icon={IndianRupee} tone="green" />
          <StatCard label="Bills today" value={t.bills_today} Icon={Receipt} tone="blue" />
          <StatCard label="This month's sales" value={rs(t.sales_month)} Icon={IndianRupee} tone="violet" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total products" value={t.total_products} Icon={Smartphone} tone="blue" hint={`${t.low_stock} low on stock`} />
        <StatCard label="Total brands" value={t.total_brands} Icon={Tags} tone="violet" />
        <StatCard label={isSuper ? 'Total branches' : 'My branches'} value={t.total_branches} Icon={Building2} tone="navy" />
        <StatCard label="Active offers" value={t.active_offers} Icon={Tag} tone="orange" />
        <StatCard label="Total inquiries" value={t.total_inquiries} Icon={Inbox} tone="green" />
        <StatCard label="New inquiries" value={t.new_inquiries} Icon={AlertTriangle} tone="rose" hint="Awaiting first contact" />
        <StatCard label="Out of stock" value={t.out_of_stock} Icon={PackageX} tone="rose" />
        {isSuper && <StatCard label="Admin accounts" value={t.total_admins} Icon={Users} tone="violet" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Inquiries — last 30 days" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data.inquiriesByDay} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="inq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2563FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} stroke="#94a3b8" />
                <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="Inquiries" stroke="#7C3AED" strokeWidth={2.5} fill="url(#inq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Inquiries by type">
          {data.inquiriesByType.length === 0 ? (
            <p className="py-20 text-center text-sm text-slate-400">No inquiries yet</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.inquiriesByType.map((d) => ({ ...d, name: INQUIRY_TYPE_LABEL[d.type] }))} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {data.inquiriesByType.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Branch-wise product availability">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.branchAvailability} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="branch" fontSize={11} stroke="#94a3b8" tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)} />
                <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="in_stock" name="In stock" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="low_stock" name="Low stock" stackId="a" fill="#F59E0B" />
                <Bar dataKey="out_of_stock" name="Out of stock" stackId="a" fill="#F43F5E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Products by brand">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.productsByBrand} layout="vertical" margin={{ left: 10, right: 16 }}>
                <defs>
                  <linearGradient id="brandBar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2563FF" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                <YAxis type="category" dataKey="brand" width={80} fontSize={11} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="count" name="Products" fill="url(#brandBar)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {can('INQUIRIES') && (
          <Panel title="Recent inquiries" actions={<Link to={`${base}/inquiries`} className="text-sm font-semibold text-electric-600 hover:underline">View all</Link>}>
            {data.recentInquiries.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No inquiries yet</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.recentInquiries.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-navy-900">{i.customerName} <span className="text-xs font-normal text-slate-400">· {i.mobile}</span></p>
                      <p className="truncate text-xs text-slate-500">{INQUIRY_TYPE_LABEL[i.type]}{i.productName ? ` · ${i.productName}` : ''}{i.branchName ? ` · ${i.branchName}` : ''}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`chip ${INQUIRY_STATUS_META[i.status].className}`}>{INQUIRY_STATUS_META[i.status].label}</span>
                      <span className="text-[11px] text-slate-400">{timeAgo(i.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        {isSuper && (
          <Panel title="Recent activity" actions={<Link to={`${base}/activity-logs`} className="text-sm font-semibold text-electric-600 hover:underline">View logs</Link>}>
            <ul className="space-y-3">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r from-electric-500 to-violet-500" />
                  <p className="flex-1 text-slate-600">
                    <span className="font-semibold text-navy-900">{a.user?.loginId ?? 'system'}</span> {a.action.toLowerCase().replace(/_/g, ' ')} <span className="text-slate-500">{a.entity}{a.entityId ? ` #${a.entityId}` : ''}</span>
                  </p>
                  <span className="text-xs text-slate-400">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </AdminPage>
  );
}
