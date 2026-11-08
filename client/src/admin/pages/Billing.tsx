import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, Copy, Download, MessageCircle, Plus, Printer, Receipt, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Invoice } from '@/components/Invoice';
import { Button, LinkButton, Modal, PageLoader, Pagination, buttonClass } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { ApiError, download, get, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateFmt, effectivePrice, PAYMENT_LABEL, rs } from '@/lib/format';
import { billWhatsappMessage, normaliseWhatsapp } from '@/lib/whatsapp';
import type { Bill, BillingSettings, BillStatus, Paginated, PaymentMode, ProductSummary } from '@/types';
import { AdminPage, DataTable, Field, Panel, SearchInput, StatCard } from '../components';

const PAYMENT_MODES = Object.keys(PAYMENT_LABEL) as PaymentMode[];
const STATUS_STYLE: Record<BillStatus, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  CANCELLED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
};

const useBillingSettings = () =>
  useQuery({ queryKey: ['admin', 'billing-settings'], queryFn: () => get<{ billing: BillingSettings; whatsappAuto: boolean }>('/admin/bills/settings'), staleTime: 60_000 });

/* ─────────────────────────── Client-side totals (mirror of server) ─────────────────────────── */

type Line = { key: number; productId: number | null; description: string; sku: string; serialNumber: string; quantity: string; unitPrice: string; discount: string; gstRate: string };

const paise = (v: string) => Math.round((Number(v) || 0) * 100);

function calc(lines: Line[], inclusive: boolean) {
  const rows = lines.map((l) => {
    const qty = Math.max(0, Math.floor(Number(l.quantity) || 0));
    const gross = paise(l.unitPrice) * qty;
    const net = Math.max(0, gross - Math.min(paise(l.discount), gross));
    const rate = Number(l.gstRate) || 0;
    if (inclusive) {
      const taxable = Math.round((net * 100) / (100 + rate));
      return { gross, taxable, gst: net - taxable, total: net };
    }
    const gst = Math.round((net * rate) / 100);
    return { gross, taxable: net, gst, total: net + gst };
  });
  const raw = rows.reduce((a, r) => a + r.total, 0);
  const total = Math.round(raw / 100) * 100;
  return {
    rows,
    subtotal: rows.reduce((a, r) => a + r.gross, 0),
    discount: rows.reduce((a, r) => a + (r.gross - (inclusive ? r.total : r.taxable)), 0),
    taxable: rows.reduce((a, r) => a + r.taxable, 0),
    gst: rows.reduce((a, r) => a + r.gst, 0),
    roundOff: total - raw,
    total,
  };
}

/* ─────────────────────────────── Billing counter ─────────────────────────────── */

export function BillingCounter({ base }: { base: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notify } = useToast();
  const settings = useBillingSettings();
  const branches = useQuery({ queryKey: ['admin', 'product-options'], queryFn: () => get<{ branches: { id: number; name: string; code: string }[] }>('/admin/products/options') });
  const s = settings.data?.billing;

  const keyRef = useRef(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [branchId, setBranchId] = useState('');
  const [customer, setCustomer] = useState({ customerName: '', customerMobile: '', customerEmail: '', customerAddress: '', customerGstin: '' });
  const [payment, setPayment] = useState({ paymentMode: 'CASH' as PaymentMode, paymentReference: '', paidAmount: '', fullPayment: true, notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!branchId && branches.data?.branches[0]) setBranchId(String(branches.data.branches[0].id));
  }, [branches.data, branchId]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const results = useQuery({
    queryKey: ['admin', 'pos-search', debounced],
    queryFn: () => get<Paginated<ProductSummary>>('/admin/products', { search: debounced, limit: 8, active: 'true' }),
    enabled: debounced.length >= 2,
  });

  const blank = (): Line => ({ key: keyRef.current++, productId: null, description: '', sku: '', serialNumber: '', quantity: '1', unitPrice: '', discount: '', gstRate: String(s?.defaultGstRate ?? 0) });
  const addProduct = (p: ProductSummary) => {
    setLines((l) => [
      ...l,
      { ...blank(), productId: p.id, description: p.name, sku: p.sku, unitPrice: String(effectivePrice(p)) },
    ]);
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 0);
  };
  const update = (key: number, patch: Partial<Line>) => setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const totals = useMemo(() => calc(lines, s?.pricesIncludeGst ?? true), [lines, s?.pricesIncludeGst]);
  const paid = payment.fullPayment ? totals.total : paise(payment.paidAmount);

  const lookup = async () => {
    const m = customer.customerMobile.replace(/\D/g, '').slice(-10);
    if (m.length !== 10 || customer.customerName) return;
    try {
      const r = await get<{ customer: { customerName: string; customerEmail: string | null; customerAddress: string | null; customerGstin: string | null; billCount: number } | null }>('/admin/bills/customer', { mobile: m });
      if (r.customer) {
        setCustomer((c) => ({
          ...c,
          customerName: r.customer!.customerName,
          customerEmail: r.customer!.customerEmail ?? '',
          customerAddress: r.customer!.customerAddress ?? '',
          customerGstin: r.customer!.customerGstin ?? '',
        }));
        notify(`Returning customer — ${r.customer.billCount} previous bill(s)`, 'info');
      }
    } catch {
      /* lookup is optional */
    }
  };

  const save = useMutation({
    mutationFn: () =>
      post<{ id: number; billNumber: string; whatsapp: { ok: boolean; error?: string } | null }>('/admin/bills', {
        branchId: Number(branchId),
        ...customer,
        paymentMode: payment.paymentMode,
        paymentReference: payment.paymentReference || null,
        paidAmount: payment.fullPayment ? null : Number(payment.paidAmount || 0),
        notes: payment.notes || null,
        items: lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          sku: l.sku || null,
          serialNumber: l.serialNumber || null,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice || 0),
          discount: Number(l.discount || 0),
          gstRate: Number(l.gstRate || 0),
        })),
      }),
    onSuccess: (r) => {
      if (r.whatsapp?.ok) notify(`Bill ${r.billNumber} saved & sent to customer's WhatsApp ✅`);
      else if (r.whatsapp) notify(`Bill ${r.billNumber} saved, but WhatsApp sending failed: ${r.whatsapp.error}`, 'error');
      else notify(`Bill ${r.billNumber} saved`);
      qc.invalidateQueries({ queryKey: ['admin', 'bills'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      navigate(`${base}/billing/${r.id}?new=1`);
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? e.fieldErrors : {});
      notify((e as Error).message, 'error');
    },
  });

  if (settings.isLoading || branches.isLoading) return <PageLoader />;
  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-rose-500">{errors[k]}</p>;

  return (
    <AdminPage
      title="Billing Counter"
      subtitle={`${settings.data?.whatsappAuto ? 'Bill goes to the customer’s WhatsApp automatically on save' : 'Bill numbers are generated automatically per branch & financial year'} · Prices ${s?.pricesIncludeGst ? 'include' : 'exclude'} GST`}
      actions={<LinkButton to={`${base}/billing`} variant="outline"><Receipt className="h-4 w-4" /> All bills</LinkButton>}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Items">
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product by name, SKU or brand to add…"
                className="input pl-9"
                aria-label="Search products"
              />
              {debounced.length >= 2 && search.trim().length >= 2 && results.data && (
                <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {results.data.items.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-electric-50">
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-navy-900">{p.name}</span>
                          <span className="text-xs text-slate-500">{p.sku} · {p.brand.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold">₹{effectivePrice(p).toLocaleString('en-IN')}</span>
                      </button>
                    </li>
                  ))}
                  {results.data.items.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No product found — use “Add custom item”.</li>}
                </ul>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">Search a product above or add a custom item</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="pb-2">Item</th>
                      <th className="pb-2">IMEI / Serial</th>
                      <th className="w-16 pb-2">Qty</th>
                      <th className="w-28 pb-2">Rate (₹)</th>
                      <th className="w-24 pb-2">Disc. (₹)</th>
                      <th className="w-20 pb-2">GST %</th>
                      <th className="w-28 pb-2 text-right">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <tr key={l.key} className="align-top">
                        <td className="py-2 pr-2"><input className="input py-2" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} placeholder="Item description" />{err(`items.${i}.description`)}</td>
                        <td className="py-2 pr-2"><input className="input py-2 font-mono text-xs" value={l.serialNumber} onChange={(e) => update(l.key, { serialNumber: e.target.value })} placeholder="Optional" /></td>
                        <td className="py-2 pr-2"><input className="input py-2" type="number" min={1} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} /></td>
                        <td className="py-2 pr-2"><input className="input py-2" type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} /></td>
                        <td className="py-2 pr-2"><input className="input py-2" type="number" min={0} step="0.01" value={l.discount} onChange={(e) => update(l.key, { discount: e.target.value })} /></td>
                        <td className="py-2 pr-2">
                          <select className="input py-2" value={l.gstRate} onChange={(e) => update(l.key, { gstRate: e.target.value })}>
                            {[0, 3, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="py-2 pt-4 text-right font-semibold">{rs(totals.rows[i]?.total ?? 0)}</td>
                        <td className="py-2 pt-3">
                          <button type="button" onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setLines((l) => [...l, blank()])}><Plus className="h-4 w-4" /> Add custom item</Button>
            {errors.items && <p className="mt-2 text-xs text-rose-500">{errors.items}</p>}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer">
            <div className="space-y-3">
              <Field label="Branch *" error={errors.branchId}>
                <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {branches.data?.branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
                </select>
              </Field>
              <Field label="Mobile number *" error={errors.customerMobile}>
                <input className="input" inputMode="tel" value={customer.customerMobile} onChange={(e) => setCustomer({ ...customer, customerMobile: e.target.value })} onBlur={lookup} placeholder="10-digit mobile" />
              </Field>
              <Field label="Customer name (optional)" error={errors.customerName}>
                <input className="input" value={customer.customerName} onChange={(e) => setCustomer({ ...customer, customerName: e.target.value })} />
              </Field>
              <details className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-slate-600">Address, email & GSTIN (optional)</summary>
                <div className="mt-3 space-y-3">
                  <Field label="Address"><textarea rows={2} className="input" value={customer.customerAddress} onChange={(e) => setCustomer({ ...customer, customerAddress: e.target.value })} /></Field>
                  <Field label="Email" error={errors.customerEmail}><input className="input" type="email" value={customer.customerEmail} onChange={(e) => setCustomer({ ...customer, customerEmail: e.target.value })} /></Field>
                  <Field label="Customer GSTIN" error={errors.customerGstin}><input className="input uppercase" value={customer.customerGstin} onChange={(e) => setCustomer({ ...customer, customerGstin: e.target.value })} /></Field>
                </div>
              </details>
            </div>
          </Panel>

          <Panel title="Payment">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_MODES.map((m) => (
                  <button key={m} type="button" onClick={() => setPayment({ ...payment, paymentMode: m })} className={cn('rounded-xl px-2 py-2 text-xs font-semibold transition', payment.paymentMode === m ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                    {PAYMENT_LABEL[m]}
                  </button>
                ))}
              </div>
              {payment.paymentMode !== 'CASH' && (
                <Field label="Reference (UPI txn / card / finance no.)"><input className="input" value={payment.paymentReference} onChange={(e) => setPayment({ ...payment, paymentReference: e.target.value })} /></Field>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={payment.fullPayment} onChange={(e) => setPayment({ ...payment, fullPayment: e.target.checked })} />
                Full payment received
              </label>
              {!payment.fullPayment && (
                <Field label="Amount received (₹)" error={errors.paidAmount}><input className="input" type="number" min={0} step="0.01" value={payment.paidAmount} onChange={(e) => setPayment({ ...payment, paidAmount: e.target.value })} /></Field>
              )}
              <Field label="Note on bill (optional)"><input className="input" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} /></Field>
            </div>
          </Panel>

          <div className="sticky bottom-4 rounded-2xl bg-navy-950 p-5 text-white shadow-2xl">
            <dl className="space-y-1 text-sm text-slate-300">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{rs(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {rs(totals.discount)}</dd></div>}
              <div className="flex justify-between"><dt>GST (incl. CGST + SGST)</dt><dd>{rs(totals.gst)}</dd></div>
              {totals.roundOff !== 0 && <div className="flex justify-between"><dt>Round off</dt><dd>{rs(totals.roundOff)}</dd></div>}
            </dl>
            <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
              <span className="text-sm text-slate-400">Total</span>
              <span className="text-3xl font-extrabold">{rs(totals.total)}</span>
            </div>
            {!payment.fullPayment && totals.total - paid > 0 && <p className="mt-1 text-right text-xs text-amber-300">Balance due {rs(totals.total - paid)}</p>}
            <Button className="mt-4 w-full" size="lg" disabled={!lines.length || totals.total <= 0} loading={save.isPending} onClick={() => { setErrors({}); save.mutate(); }}>
              {settings.data?.whatsappAuto ? <MessageCircle className="h-5 w-5" /> : <Receipt className="h-5 w-5" />} {settings.data?.whatsappAuto ? 'Save & send on WhatsApp' : 'Save bill'}
            </Button>
          </div>
        </div>
      </div>
    </AdminPage>
  );
}

/* ─────────────────────────────── Bills list ─────────────────────────────── */

type BillRow = { id: number; billNumber: string; billDate: string; customerName: string; customerMobile: string; totalPaise: number; paidPaise: number; paymentMode: PaymentMode; status: BillStatus; whatsappSentAt: string | null; whatsappStatus: Bill['whatsappStatus']; branchName: string; createdBy: string | null; itemCount: number };

export function BillsList({ base }: { base: string }) {
  const { can } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ search: '', status: '', paymentMode: '', branchId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const branches = useQuery({ queryKey: ['admin', 'product-options'], queryFn: () => get<{ branches: { id: number; name: string }[] }>('/admin/products/options') });
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bills', f, page],
    queryFn: () => get<{ items: BillRow[]; summary: { count: number; totalPaise: number; paidPaise: number; cancelled: number }; pagination: { page: number; totalPages: number } }>('/admin/bills', { ...f, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <AdminPage
      title="Bills"
      subtitle="Every bill is saved permanently — cancelled bills stay in the record"
      actions={
        <>
          <Button variant="outline" onClick={() => download('/admin/bills/export.csv', f).catch((e) => notify(e.message, 'error'))}><Download className="h-4 w-4" /> Export CSV</Button>
          {can('BILLING', 'create') && <LinkButton to={`${base}/billing/new`}><Plus className="h-4 w-4" /> New bill</LinkButton>}
        </>
      }
    >
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Bills" value={data?.summary.count ?? '—'} Icon={Receipt} tone="blue" hint={data?.summary.cancelled ? `${data.summary.cancelled} cancelled` : undefined} />
        <StatCard label="Sales (excl. cancelled)" value={data ? rs(data.summary.totalPaise) : '—'} Icon={Receipt} tone="violet" />
        <StatCard label="Received" value={data ? rs(data.summary.paidPaise) : '—'} Icon={Receipt} tone="green" hint={data && data.summary.totalPaise > data.summary.paidPaise ? `${rs(data.summary.totalPaise - data.summary.paidPaise)} pending` : undefined} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={f.search} onChange={(v) => set('search', v)} placeholder="Bill no, customer, mobile, IMEI…" />
        <select className="input w-auto" value={f.status} onChange={(e) => set('status', e.target.value)} aria-label="Status">
          <option value="">All status</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="CANCELLED">Cancelled</option>
        </select>
        <select className="input w-auto" value={f.paymentMode} onChange={(e) => set('paymentMode', e.target.value)} aria-label="Payment">
          <option value="">All payments</option>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_LABEL[m]}</option>)}
        </select>
        {(branches.data?.branches.length ?? 0) > 1 && (
          <select className="input w-auto" value={f.branchId} onChange={(e) => set('branchId', e.target.value)} aria-label="Branch">
            <option value="">All branches</option>{branches.data?.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="date" className="input w-auto" value={f.from} max={today} onChange={(e) => set('from', e.target.value)} aria-label="From" />
        <input type="date" className="input w-auto" value={f.to} max={today} onChange={(e) => set('to', e.target.value)} aria-label="To" />
        <Button variant="ghost" size="sm" onClick={() => { setF((x) => ({ ...x, from: today, to: today })); setPage(1); }}>Today</Button>
      </div>
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        empty="No bills yet"
        onRowClick={(b) => navigate(`${base}/billing/${b.id}`)}
        columns={[
          { key: 'no', label: 'Bill No', render: (b) => <span className="font-mono text-xs font-semibold text-navy-900">{b.billNumber}</span> },
          { key: 'date', label: 'Date', render: (b) => <span className="text-xs text-slate-500">{dateFmt(b.billDate, true)}</span> },
          { key: 'cust', label: 'Customer', render: (b) => <div><p className="font-medium">{b.customerName}</p><p className="text-xs text-slate-500">{b.customerMobile}</p></div> },
          { key: 'items', label: 'Items', render: (b) => b.itemCount },
          { key: 'total', label: 'Total', render: (b) => <span className="font-semibold">{rs(b.totalPaise)}</span> },
          { key: 'pay', label: 'Payment', render: (b) => PAYMENT_LABEL[b.paymentMode] },
          { key: 'status', label: 'Status', render: (b) => <span className={cn('chip', STATUS_STYLE[b.status])}>{b.status}</span> },
          { key: 'wa', label: 'WhatsApp', render: (b) => (b.whatsappStatus === 'FAILED' ? <span title="Sending failed"><AlertTriangle className="h-4 w-4 text-rose-500" /></span> : b.whatsappSentAt ? <span title={b.whatsappStatus === 'AUTO_SENT' ? 'Sent automatically' : 'Sent manually'}><MessageCircle className="h-4 w-4 text-[#25D366]" /></span> : <span className="text-slate-300">—</span>) },
        ]}
      />
      {data && <div className="mt-6"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} /></div>}
    </AdminPage>
  );
}

/* ─────────────────────────────── Bill view ─────────────────────────────── */

export function BillView({ base }: { base: string }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { can } = useAuth();
  const { notify } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'bill', id], queryFn: () => get<{ bill: Bill; billing: BillingSettings }>(`/admin/bills/${id}`) });
  const auto = useBillingSettings().data?.whatsappAuto ?? false;
  const resend = useMutation({
    mutationFn: () => post<{ whatsapp: { ok: boolean; error?: string } }>(`/admin/bills/${id}/send-whatsapp`),
    onSuccess: (r) => {
      notify(r.whatsapp.ok ? 'Bill sent on WhatsApp ✅' : `Sending failed: ${r.whatsapp.error}`, r.whatsapp.ok ? 'success' : 'error');
      qc.invalidateQueries({ queryKey: ['admin', 'bill', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'bills'] });
    },
    onError: (e) => notify((e as Error).message, 'error'),
  });

  const cancel = useMutation({
    mutationFn: () => post(`/admin/bills/${id}/cancel`, { reason }),
    onSuccess: () => { notify('Bill cancelled'); setCancelOpen(false); qc.invalidateQueries({ queryKey: ['admin', 'bill', id] }); qc.invalidateQueries({ queryKey: ['admin', 'bills'] }); },
    onError: (e) => notify((e as Error).message, 'error'),
  });

  if (isLoading || !data) return <PageLoader />;
  const { bill, billing } = data;
  const link = `${window.location.origin}/bill/${bill.publicToken}`;
  const waNumber = normaliseWhatsapp(bill.customerMobile);
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(billWhatsappMessage({ ...bill, paymentMode: PAYMENT_LABEL[bill.paymentMode] }, link, billing.businessName))}` : null;

  const sendWhatsapp = () => {
    if (!waHref) return;
    window.open(waHref, '_blank', 'noopener');
    post(`/admin/bills/${bill.id}/whatsapp-sent`).then(() => qc.invalidateQueries({ queryKey: ['admin', 'bill', id] })).catch(() => {});
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to={`${base}/billing`} className="text-sm text-slate-500 hover:text-navy-900">← All bills</Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">{bill.billNumber}</h1>
          <p className="text-xs text-slate-500">
            Billed by {bill.createdBy?.loginId ?? '—'}{bill.whatsappSentAt ? ` · WhatsApp sent ${dateFmt(bill.whatsappSentAt, true)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="whatsapp" onClick={sendWhatsapp} disabled={!waHref || bill.status === 'CANCELLED'}><MessageCircle className="h-4 w-4" /> Send on WhatsApp</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / PDF</Button>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(link).then(() => notify('Bill link copied'))}><Copy className="h-4 w-4" /> Copy link</Button>
          {can('BILLING', 'create') && <Link to={`${base}/billing/new`} className={buttonClass('primary')}><Plus className="h-4 w-4" /> New bill</Link>}
          {can('BILLING', 'edit') && bill.status !== 'CANCELLED' && <Button variant="ghost" className="text-rose-600" onClick={() => setCancelOpen(true)}><Ban className="h-4 w-4" /> Cancel bill</Button>}
        </div>
      </div>
      {bill.whatsappStatus === 'AUTO_SENT' && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200 print:hidden">
          <CheckCircle2 className="h-5 w-5" /> Bill sent automatically to {bill.customerMobile} on WhatsApp {bill.whatsappSentAt ? `(${dateFmt(bill.whatsappSentAt, true)})` : ''}
        </div>
      )}
      {bill.whatsappStatus === 'FAILED' && bill.status !== 'CANCELLED' && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200 print:hidden sm:flex-row sm:items-center">
          <p className="flex items-start gap-2 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> Automatic WhatsApp sending failed: {bill.whatsappError}</p>
          <div className="flex shrink-0 gap-2">
            {auto && <Button size="sm" variant="outline" loading={resend.isPending} onClick={() => resend.mutate()}><RefreshCw className="h-4 w-4" /> Retry</Button>}
            <Button size="sm" variant="whatsapp" onClick={sendWhatsapp}><MessageCircle className="h-4 w-4" /> Send manually</Button>
          </div>
        </div>
      )}
      {params.get('new') && !bill.whatsappSentAt && !bill.whatsappStatus && bill.status !== 'CANCELLED' && (
        <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200 print:hidden sm:flex-row sm:items-center">
          <p className="text-sm text-emerald-800">✅ Bill saved. Send it to <b>{bill.customerName}</b> on WhatsApp ({bill.customerMobile}).</p>
          <Button variant="whatsapp" size="sm" onClick={sendWhatsapp}><MessageCircle className="h-4 w-4" /> Send now</Button>
        </div>
      )}
      <Invoice bill={bill} settings={billing} />
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this bill?" size="sm" footer={<Button variant="danger" disabled={reason.trim().length < 3} loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel bill</Button>}>
        <p className="mb-3 text-sm text-slate-600">The bill stays in records marked as CANCELLED and is excluded from sales totals. This cannot be undone.</p>
        <Field label="Reason *"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong item billed" /></Field>
      </Modal>
    </div>
  );
}
