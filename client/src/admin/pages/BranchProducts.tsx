import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, EmptyState, Pagination } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { get, put } from '@/lib/api';
import { inr, STOCK_META } from '@/lib/format';
import type { Pagination as P, StockStatus } from '@/types';
import { AdminPage, DataTable, SearchInput, Toggle } from '../components';

type Row = {
  productId: number;
  name: string;
  sku: string;
  brand: string;
  category: string;
  type: string;
  sellingPrice: number;
  offerPrice: number | null;
  assigned: boolean;
  stockStatus: StockStatus | null;
  branchPrice: number | null;
};
type Edit = { assigned: boolean; stockStatus: StockStatus; branchPrice: string };

export default function BranchProducts() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [assigned, setAssigned] = useState('all');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const branches = useQuery({ queryKey: ['admin', 'branches', ''], queryFn: () => get<{ items: { id: number; name: string }[] }>('/admin/branches') });
  const branchId = Number(params.get('branch')) || branches.data?.items[0]?.id;

  useEffect(() => setEdits({}), [branchId]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'branch-products', branchId, search, assigned, page],
    queryFn: () => get<{ items: Row[]; pagination: P }>(`/admin/branch-products/${branchId}`, { search, assigned, page, limit: 30 }),
    enabled: Boolean(branchId),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: () =>
      put(`/admin/branch-products/${branchId}`, {
        items: Object.entries(edits).map(([pid, e]) => ({ productId: Number(pid), assigned: e.assigned, stockStatus: e.stockStatus, branchPrice: e.branchPrice === '' ? null : Number(e.branchPrice) })),
      }),
    onSuccess: () => {
      notify('Branch availability saved');
      setEdits({});
      qc.invalidateQueries({ queryKey: ['admin', 'branch-products'] });
    },
    onError: (e) => notify((e as Error).message, 'error'),
  });

  const current = (r: Row): Edit => edits[r.productId] ?? { assigned: r.assigned, stockStatus: r.stockStatus ?? 'IN_STOCK', branchPrice: r.branchPrice == null ? '' : String(r.branchPrice) };
  const change = (r: Row, patch: Partial<Edit>) => setEdits((e) => ({ ...e, [r.productId]: { ...current(r), ...patch } }));
  const editable = can('BRANCH_PRODUCTS', 'edit');
  const dirty = Object.keys(edits).length;

  if (branches.data && !branches.data.items.length) return <AdminPage title="Branch Product Availability"><EmptyState title="No branches assigned to your account" /></AdminPage>;

  return (
    <AdminPage
      title="Branch Product Availability"
      subtitle="Assign products to a branch and set branch stock / price"
      actions={editable && <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save {dirty ? `(${dirty})` : ''}</Button>}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input w-auto" value={branchId ?? ''} onChange={(e) => { setParams({ branch: e.target.value }); setPage(1); }} aria-label="Branch">
          {branches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        <select className="input w-auto" value={assigned} onChange={(e) => { setAssigned(e.target.value); setPage(1); }} aria-label="Assigned filter">
          <option value="all">All products</option><option value="yes">Assigned</option><option value="no">Not assigned</option>
        </select>
      </div>
      <DataTable
        rows={(data?.items ?? []).map((r) => ({ ...r, id: r.productId }))}
        loading={isLoading}
        columns={[
          { key: 'assigned', label: 'At branch', render: (r) => <Toggle checked={current(r).assigned} disabled={!editable} onChange={(v) => change(r, { assigned: v })} /> },
          { key: 'name', label: 'Product', render: (r) => <div><p className="font-semibold text-navy-900">{r.name}</p><p className="text-xs text-slate-500">{r.sku} · {r.brand} · {r.category}</p></div> },
          { key: 'price', label: 'Website price', render: (r) => inr(r.offerPrice ?? r.sellingPrice) },
          { key: 'stock', label: 'Branch stock', render: (r) => (
            <select className="input py-1.5 text-xs" value={current(r).stockStatus} disabled={!editable || !current(r).assigned} onChange={(e) => change(r, { stockStatus: e.target.value as StockStatus })}>
              {(Object.keys(STOCK_META) as StockStatus[]).map((s) => <option key={s} value={s}>{STOCK_META[s].label}</option>)}
            </select>
          ) },
          { key: 'bprice', label: 'Branch price (optional)', render: (r) => <input type="number" min={0} className="input w-32 py-1.5 text-xs" disabled={!editable || !current(r).assigned} value={current(r).branchPrice} onChange={(e) => change(r, { branchPrice: e.target.value })} /> },
        ]}
      />
      {data && <div className="mt-6"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} /></div>}
    </AdminPage>
  );
}
