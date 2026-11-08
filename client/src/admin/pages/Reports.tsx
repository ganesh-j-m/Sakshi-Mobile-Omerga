import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Download, Inbox, Timer } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, PageLoader } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { download, get } from '@/lib/api';
import { INQUIRY_TYPE_LABEL, STOCK_META } from '@/lib/format';
import type { InquiryType, StockStatus } from '@/types';
import { AdminPage, Panel, StatCard } from '../components';

type Summary = {
  range: { from: string; to: string };
  overview: { total: number; resolved: number; open: number; avg_hours_to_contact: number | null };
  byBranch: { branch: string; total: number; resolved: number }[];
  byType: { type: InquiryType; count: number }[];
  topProducts: { product: string; count: number }[];
  stock: { status: StockStatus; count: number }[];
  byCategory: { category: string; count: number }[];
};

const COLORS = ['#2563FF', '#7C3AED', '#FF7A18', '#10B981', '#F43F5E', '#0EA5E9'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Reports() {
  const { notify } = useToast();
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [to, setTo] = useState(iso(new Date()));
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'reports', from, to], queryFn: () => get<Summary>('/admin/reports/summary', { from, to }) });
  const rate = data && data.overview.total ? Math.round((data.overview.resolved / data.overview.total) * 100) : 0;

  return (
    <AdminPage
      title="Reports"
      subtitle="Inquiry performance and catalogue health"
      actions={
        <>
          <Button variant="outline" onClick={() => download('/admin/reports/inquiries.csv', { from, to }).catch((e) => notify(e.message, 'error'))}><Download className="h-4 w-4" /> Inquiries CSV</Button>
          <Button variant="outline" onClick={() => download('/admin/reports/products.csv').catch((e) => notify(e.message, 'error'))}><Download className="h-4 w-4" /> Products CSV</Button>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm"><span className="label">From</span><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="label">To</span><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {isLoading || !data ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Inquiries" value={data.overview.total} Icon={Inbox} tone="blue" />
            <StatCard label="Resolved / closed" value={data.overview.resolved} Icon={CheckCircle2} tone="green" hint={`${rate}% resolution rate`} />
            <StatCard label="Open" value={data.overview.open} Icon={Clock} tone="orange" />
            <StatCard label="Avg. time to contact" value={data.overview.avg_hours_to_contact != null ? `${data.overview.avg_hours_to_contact}h` : '—'} Icon={Timer} tone="violet" />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Inquiries by branch">
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={data.byBranch} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="branch" fontSize={11} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} fontSize={11} stroke="#94a3b8" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Total" fill="#2563FF" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="resolved" name="Resolved" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Inquiries by type">
              <div className="h-72">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.byType.map((d) => ({ ...d, name: INQUIRY_TYPE_LABEL[d.type] }))} dataKey="count" nameKey="name" outerRadius={95} label>
                      {data.byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Most enquired products">
              {data.topProducts.length === 0 ? <p className="py-10 text-center text-sm text-slate-400">No product inquiries in this period</p> : (
                <ol className="space-y-2">
                  {data.topProducts.map((p, i) => (
                    <li key={p.product} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-600">{i + 1}</span>
                      <span className="flex-1 text-sm text-navy-900">{p.product}</span>
                      <span className="text-sm font-semibold">{p.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Catalogue stock & categories">
              <div className="grid gap-4 sm:grid-cols-2">
                <ul className="space-y-2">
                  {data.stock.map((s) => (
                    <li key={s.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span className={`chip ${STOCK_META[s.status].className}`}>{STOCK_META[s.status].label}</span>
                      <b>{s.count}</b>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-2">
                  {data.byCategory.map((c) => (
                    <li key={c.category} className="flex items-center justify-between text-sm"><span className="text-slate-600">{c.category}</span><b>{c.count}</b></li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>
        </>
      )}
    </AdminPage>
  );
}
