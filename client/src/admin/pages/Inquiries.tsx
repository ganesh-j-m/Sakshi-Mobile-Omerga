import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, MessageCircle, Phone, PhoneCall, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, Pagination } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { del, download, get, patch, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateFmt, INQUIRY_STATUS_META, INQUIRY_TYPE_LABEL, timeAgo } from '@/lib/format';
import type { Inquiry, InquiryStatus, InquiryType, Pagination as P } from '@/types';
import { AdminPage, DataTable, SearchInput, useConfirm } from '../components';

type Resp = { items: Inquiry[]; counts: Partial<Record<InquiryStatus, number>>; pagination: P };
const STATUSES = Object.keys(INQUIRY_STATUS_META) as InquiryStatus[];

function StatusPill({ s }: { s: InquiryStatus }) {
  return <span className={cn('chip', INQUIRY_STATUS_META[s].className)}>{INQUIRY_STATUS_META[s].label}</span>;
}

function InquiryDetail({ inquiry, onChanged, onClose }: { inquiry: Inquiry; onChanged: (i: Inquiry) => void; onClose: () => void }) {
  const { can, isSuper } = useAuth();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [note, setNote] = useState('');
  const editable = can('INQUIRIES', 'edit');
  const setStatus = useMutation({
    mutationFn: (status: InquiryStatus) => patch<{ item: Inquiry }>(`/admin/inquiries/${inquiry.id}/status`, { status, note: note || undefined }),
    onSuccess: (r) => { setNote(''); onChanged(r.item); notify(`Marked as ${INQUIRY_STATUS_META[r.item.status].label}`); },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  const addRemark = useMutation({
    mutationFn: () => post<{ item: Inquiry }>(`/admin/inquiries/${inquiry.id}/remarks`, { note }),
    onSuccess: (r) => { setNote(''); onChanged(r.item); },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  const wa = `https://wa.me/91${inquiry.mobile}?text=${encodeURIComponent(`Hello ${inquiry.customerName}, this is Sakshi Mobile regarding your inquiry${inquiry.productName ? ` about ${inquiry.productName}` : ''}.`)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill s={inquiry.status} />
        <span className="chip bg-slate-100 text-slate-600">{INQUIRY_TYPE_LABEL[inquiry.type]}</span>
        <span className="text-xs text-slate-400">Received {dateFmt(inquiry.createdAt, true)}</span>
      </div>
      <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <p><span className="text-slate-500">Customer:</span> <b>{inquiry.customerName}</b></p>
        <p><span className="text-slate-500">Mobile:</span> <b>{inquiry.mobile}</b></p>
        {inquiry.email && <p><span className="text-slate-500">Email:</span> {inquiry.email}</p>}
        <p><span className="text-slate-500">Branch:</span> {inquiry.branchName ?? 'Any'}</p>
        {inquiry.productName && <p className="sm:col-span-2"><span className="text-slate-500">Product:</span> <Link to={`/mobiles/${inquiry.productSlug}`} target="_blank" className="text-electric-600 hover:underline">{inquiry.productName}</Link></p>}
        {inquiry.offerTitle && <p className="sm:col-span-2"><span className="text-slate-500">Offer:</span> {inquiry.offerTitle}</p>}
        {inquiry.message && <p className="whitespace-pre-line sm:col-span-2"><span className="text-slate-500">Message:</span><br />{inquiry.message}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`tel:+91${inquiry.mobile}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-navy-900 px-3.5 text-sm font-semibold text-white"><Phone className="h-4 w-4" /> Call</a>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 text-sm font-semibold text-white"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
      </div>
      {editable && (
        <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input" placeholder="Internal remark (only visible to admins)…" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={note.trim().length < 2} loading={addRemark.isPending} onClick={() => addRemark.mutate()}><Send className="h-4 w-4" /> Add remark</Button>
            <Button size="sm" variant="secondary" loading={setStatus.isPending && setStatus.variables === 'CONTACTED'} onClick={() => setStatus.mutate('CONTACTED')}><PhoneCall className="h-4 w-4" /> Mark contacted</Button>
            <Button size="sm" loading={setStatus.isPending && setStatus.variables === 'RESOLVED'} onClick={() => setStatus.mutate('RESOLVED')}><CheckCircle2 className="h-4 w-4" /> Mark resolved</Button>
            <select className="input h-9 w-auto py-0 text-sm" value="" onChange={(e) => e.target.value && setStatus.mutate(e.target.value as InquiryStatus)} aria-label="Change status">
              <option value="">Other status…</option>
              {STATUSES.map((s) => <option key={s} value={s}>{INQUIRY_STATUS_META[s].label}</option>)}
            </select>
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">Timeline & remarks</h3>
        {inquiry.remarks.length === 0 ? (
          <p className="text-sm text-slate-400">No remarks yet.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-violet-100 pl-4">
            {[...inquiry.remarks].reverse().map((r, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-violet-500" />
                <p className="text-sm text-navy-900">{r.note}</p>
                <p className="text-xs text-slate-400">{r.by} · {dateFmt(r.at, true)}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      {isSuper && (
        <button
          className="flex items-center gap-1.5 text-xs text-rose-500 hover:underline"
          onClick={async () => {
            if (!(await confirm({ title: 'Delete inquiry permanently?', confirmLabel: 'Delete', danger: true }))) return;
            await del(`/admin/inquiries/${inquiry.id}`);
            notify('Inquiry deleted');
            onClose();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete inquiry
        </button>
      )}
    </div>
  );
}

export default function Inquiries() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { notify } = useToast();
  const [f, setF] = useState({ search: '', status: '', type: '', branchId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Inquiry | null>(null);
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const branches = useQuery({ queryKey: ['admin', 'branches', ''], queryFn: () => get<{ items: { id: number; name: string }[] }>('/admin/branches'), enabled: can('BRANCHES') });
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'inquiries', f, page],
    queryFn: () => get<Resp>('/admin/inquiries', { ...f, page }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'inquiries'] });
  const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <AdminPage
      title="Customer Inquiries"
      subtitle="Leads from the website inquiry forms"
      actions={can('REPORTS') && <Button variant="outline" onClick={() => download('/admin/reports/inquiries.csv', f).catch((e) => notify(e.message, 'error'))}><Download className="h-4 w-4" /> Export CSV</Button>}
    >
      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
        {[{ k: '', l: 'All', c: total }, ...STATUSES.map((s) => ({ k: s, l: INQUIRY_STATUS_META[s].label, c: data?.counts[s] ?? 0 }))].map((t) => (
          <button key={t.k || 'all'} onClick={() => set('status', t.k)} className={cn('shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition', f.status === t.k ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
            {t.l} <span className="ml-1 opacity-60">{t.c}</span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={f.search} onChange={(v) => set('search', v)} placeholder="Name, mobile, email, message…" />
        <select className="input w-auto" value={f.type} onChange={(e) => set('type', e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {(Object.keys(INQUIRY_TYPE_LABEL) as InquiryType[]).map((t) => <option key={t} value={t}>{INQUIRY_TYPE_LABEL[t]}</option>)}
        </select>
        {branches.data && (
          <select className="input w-auto" value={f.branchId} onChange={(e) => set('branchId', e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {branches.data.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <input type="date" className="input w-auto" value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="From date" />
        <input type="date" className="input w-auto" value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="To date" />
      </div>
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        onRowClick={setOpen}
        columns={[
          { key: 'customer', label: 'Customer', render: (i) => <div><p className="font-semibold text-navy-900">{i.customerName}</p><p className="text-xs text-slate-500">{i.mobile}</p></div> },
          { key: 'type', label: 'Type', render: (i) => INQUIRY_TYPE_LABEL[i.type] },
          { key: 'about', label: 'About', render: (i) => <span className="line-clamp-1 max-w-xs text-slate-600">{i.productName ?? i.offerTitle ?? i.message ?? '—'}</span> },
          { key: 'branch', label: 'Branch', render: (i) => i.branchName ?? <span className="text-slate-400">Any</span> },
          { key: 'status', label: 'Status', render: (i) => <StatusPill s={i.status} /> },
          { key: 'when', label: 'Received', render: (i) => <span className="text-xs text-slate-500">{timeAgo(i.createdAt)}</span> },
        ]}
      />
      {data && <div className="mt-6"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} /></div>}
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Inquiry #${open?.id ?? ''}`} size="lg">
        {open && <InquiryDetail inquiry={open} onChanged={(i) => { setOpen(i); refresh(); }} onClose={() => { setOpen(null); refresh(); }} />}
      </Modal>
    </AdminPage>
  );
}
