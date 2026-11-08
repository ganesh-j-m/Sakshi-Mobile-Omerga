import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductMedia } from '@/components/ProductMedia';
import { DemoBadge, LinkButton, Pagination, StockBadge, Button } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { del, download, get, patch } from '@/lib/api';
import { cn } from '@/lib/cn';
import { effectivePrice, inr, STOCK_META } from '@/lib/format';
import type { Paginated, ProductSummary, StockStatus } from '@/types';
import { AdminPage, DataTable, SearchInput, Toggle, useConfirm } from '../components';

export default function Products({ base }: { base: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [stock, setStock] = useState('');
  const [brand, setBrand] = useState('');
  const opts = useQuery({ queryKey: ['admin', 'product-options'], queryFn: () => get<{ brands: { id: number; name: string; slug: string }[] }>('/admin/products/options') });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', search, page, type, stock, brand],
    queryFn: () => get<Paginated<ProductSummary>>('/admin/products', { search, page, type, availability: stock, brand, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const flags = useMutation({
    mutationFn: ({ id, ...body }: { id: number; isActive?: boolean; isFeatured?: boolean; stockStatus?: StockStatus }) => patch(`/admin/products/${id}/flags`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'products'] }),
    onError: (e) => notify((e as Error).message, 'error'),
  });

  const remove = async (p: ProductSummary) => {
    if (!(await confirm({ title: 'Delete product?', text: `“${p.name}” will be removed from the website and all branches.`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await del(`/admin/products/${p.id}`);
      notify('Product deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const editable = can('PRODUCTS', 'edit');

  return (
    <AdminPage
      title="Product Management"
      subtitle="Mobiles & accessories catalogue"
      actions={
        <>
          {can('REPORTS') && <Button variant="outline" onClick={() => download('/admin/reports/products.csv').catch((e) => notify(e.message, 'error'))}><Download className="h-4 w-4" /> Export CSV</Button>}
          {can('PRODUCTS', 'create') && <LinkButton to={`${base}/products/new`}><Plus className="h-4 w-4" /> Add product</LinkButton>}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, SKU, brand…" />
        <select className="input w-auto" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Type">
          <option value="">All types</option>
          <option value="MOBILE">Mobiles</option>
          <option value="ACCESSORY">Accessories</option>
        </select>
        <select className="input w-auto" value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1); }} aria-label="Brand">
          <option value="">All brands</option>
          {opts.data?.brands.map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
        </select>
        <select className="input w-auto" value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} aria-label="Stock">
          <option value="">Any stock</option>
          {(Object.keys(STOCK_META) as StockStatus[]).map((s) => <option key={s} value={s}>{STOCK_META[s].label}</option>)}
        </select>
      </div>
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        columns={[
          {
            key: 'product',
            label: 'Product',
            render: (p) => (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1">
                  <ProductMedia url={p.images[0]?.url} alt="" type={p.category.type} categorySlug={p.category.slug} color={p.colors[0]?.hex} />
                </div>
                <div className="min-w-0">
                  <Link to={`${base}/products/${p.id}`} className="block truncate font-semibold text-navy-900 hover:text-electric-600">{p.name}</Link>
                  <p className="text-xs text-slate-500">{p.sku} · {p.brand.name} · {p.category.name} {p.isDemo && <DemoBadge label="Demo" className="ml-1" />}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'price',
            label: 'Price',
            render: (p) => (
              <div>
                <p className="font-semibold">{inr(effectivePrice(p))}</p>
                <p className="text-xs text-slate-400 line-through">{p.mrp > effectivePrice(p) ? inr(p.mrp) : ''}</p>
              </div>
            ),
          },
          {
            key: 'stock',
            label: 'Stock',
            render: (p) =>
              editable ? (
                <select
                  value={p.stockStatus}
                  onChange={(e) => flags.mutate({ id: p.id, stockStatus: e.target.value as StockStatus })}
                  className={cn('rounded-lg border-0 px-2 py-1 text-xs font-semibold', STOCK_META[p.stockStatus].className)}
                  aria-label="Stock status"
                >
                  {(Object.keys(STOCK_META) as StockStatus[]).map((s) => <option key={s} value={s}>{STOCK_META[s].label}</option>)}
                </select>
              ) : (
                <StockBadge status={p.stockStatus} />
              ),
          },
          {
            key: 'featured',
            label: 'Featured',
            render: (p) => (
              <button disabled={!editable} onClick={() => flags.mutate({ id: p.id, isFeatured: !p.isFeatured })} aria-label="Toggle featured" className="disabled:opacity-50">
                <Star className={cn('h-5 w-5 transition', p.isFeatured ? 'fill-flame-400 text-flame-400' : 'text-slate-300 hover:text-flame-300')} />
              </button>
            ),
          },
          { key: 'active', label: 'Active', render: (p) => <Toggle checked={p.isActive} disabled={!editable} onChange={(v) => flags.mutate({ id: p.id, isActive: v })} label="Active" /> },
          {
            key: 'actions',
            label: '',
            className: 'text-right',
            render: (p) => (
              <div className="flex justify-end gap-1">
                {editable && <Link to={`${base}/products/${p.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-electric-50 hover:text-electric-600" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>}
                {can('PRODUCTS', 'delete') && <button onClick={() => remove(p)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
              </div>
            ),
          },
        ]}
      />
      {data && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">{data.pagination.total} products</p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}
