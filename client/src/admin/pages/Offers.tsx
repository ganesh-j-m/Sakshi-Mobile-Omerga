import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, DemoBadge, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { ApiError, del, get, patch, post, put } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateFmt, OFFER_TYPE_LABEL } from '@/lib/format';
import type { Offer, OfferType, Paginated, ProductSummary } from '@/types';
import { AdminPage, DataTable, Field, ImageInput, SearchInput, Toggle, useConfirm } from '../components';

type AdminOffer = Offer & { isActive: boolean; sortOrder: number; branchIds: number[]; editable: boolean; productId: number | null; brandId: number | null };
type Options = { brands: { id: number; name: string }[]; branches: { id: number; name: string }[] };

const schema = z.object({
  title: z.string().trim().min(3, 'Title is required').max(160),
  slug: z.string().optional(),
  description: z.string().max(3000).optional().nullable(),
  offerType: z.enum(['DISCOUNT', 'CASHBACK', 'EXCHANGE', 'EMI', 'BUNDLE', 'FESTIVAL']),
  discountType: z.enum(['PERCENT', 'FLAT', 'NONE']),
  discountValue: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  badge: z.string().max(40).optional().nullable(),
  bannerUrl: z.string().nullable().optional(),
  productId: z.string().optional(),
  brandId: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  terms: z.string().max(4000).optional().nullable(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  branchIds: z.array(z.number()),
});
type Values = z.input<typeof schema>;

const toDate = (v: string | null) => (v ? v.slice(0, 10) : '');

function OfferForm({ offer, options, products, onDone }: { offer: AdminOffer | null; options: Options; products: ProductSummary[]; onDone: () => void }) {
  const { notify } = useToast();
  const { isSuper } = useAuth();
  const { register, control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: offer
      ? {
          title: offer.title, slug: offer.slug, description: offer.description ?? '', offerType: offer.offerType, discountType: offer.discountType,
          discountValue: offer.discountValue ?? '', badge: offer.badge ?? '', bannerUrl: offer.bannerUrl, productId: offer.productId ? String(offer.productId) : '',
          brandId: offer.brandId ? String(offer.brandId) : '', validFrom: toDate(offer.validFrom), validTo: toDate(offer.validTo), terms: offer.terms ?? '',
          isFeatured: offer.isFeatured, isActive: offer.isActive, sortOrder: offer.sortOrder, branchIds: offer.branchIds,
        }
      : { offerType: 'DISCOUNT', discountType: 'NONE', isFeatured: false, isActive: true, sortOrder: 0, branchIds: isSuper ? [] : options.branches.map((b) => b.id) },
  });
  const save = useMutation({
    mutationFn: (v: z.output<typeof schema>) => {
      const body = {
        ...v,
        discountValue: v.discountValue === '' || v.discountValue == null ? null : Number(v.discountValue),
        productId: v.productId ? Number(v.productId) : null,
        brandId: v.brandId ? Number(v.brandId) : null,
        validFrom: v.validFrom ? new Date(`${v.validFrom}T00:00:00`).toISOString() : null,
        validTo: v.validTo ? new Date(`${v.validTo}T23:59:59`).toISOString() : null,
      };
      return offer ? put(`/admin/offers/${offer.id}`, body) : post('/admin/offers', body);
    },
    onSuccess: () => {
      notify('Offer saved');
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as keyof Values, { message: m });
      notify((e as Error).message, 'error');
    },
  });
  const err = (k: keyof Values) => formState.errors[k]?.message as string | undefined;

  return (
    <form id="offer-form" onSubmit={handleSubmit((v) => save.mutate(v as z.output<typeof schema>))} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Title *" error={err('title')} className="sm:col-span-2"><input className="input" {...register('title')} /></Field>
      <Field label="Offer type"><select className="input" {...register('offerType')}>{(Object.keys(OFFER_TYPE_LABEL) as OfferType[]).map((t) => <option key={t} value={t}>{OFFER_TYPE_LABEL[t]}</option>)}</select></Field>
      <Field label="Badge text" hint="e.g. Festive deal"><input className="input" {...register('badge')} /></Field>
      <Field label="Discount type"><select className="input" {...register('discountType')}><option value="NONE">None</option><option value="PERCENT">Percent (%)</option><option value="FLAT">Flat (₹)</option></select></Field>
      <Field label="Discount value" error={err('discountValue')}><input type="number" min={0} className="input" {...register('discountValue')} /></Field>
      <Field label="Brand (optional)"><select className="input" {...register('brandId')}><option value="">Any brand</option>{options.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Product (optional)"><select className="input" {...register('productId')}><option value="">Any product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      <Field label="Valid from"><input type="date" className="input" {...register('validFrom')} /></Field>
      <Field label="Valid to" error={err('validTo')}><input type="date" className="input" {...register('validTo')} /></Field>
      <Field label="Description" className="sm:col-span-2"><textarea rows={3} className="input" {...register('description')} /></Field>
      <Field label="Terms & conditions" className="sm:col-span-2"><textarea rows={3} className="input" {...register('terms')} /></Field>
      <div className="sm:col-span-2"><Controller control={control} name="bannerUrl" render={({ field }) => <ImageInput label="Banner image (optional)" folder="offers" value={field.value} onChange={field.onChange} />} /></div>
      <Field label={isSuper ? 'Branches (none = all branches)' : 'Branches *'} error={err('branchIds')} className="sm:col-span-2">
        <Controller
          control={control}
          name="branchIds"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {options.branches.map((b) => {
                const on = field.value.includes(b.id);
                return (
                  <button type="button" key={b.id} onClick={() => field.onChange(on ? field.value.filter((x) => x !== b.id) : [...field.value, b.id])} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium transition', on ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                    {b.name}
                  </button>
                );
              })}
            </div>
          )}
        />
      </Field>
      <Field label="Display order"><input type="number" min={0} className="input" {...register('sortOrder')} /></Field>
      <div className="flex items-end gap-6 pb-2">
        <Controller control={control} name="isFeatured" render={({ field }) => <label className="flex items-center gap-2 text-sm">Featured <Toggle checked={field.value} onChange={field.onChange} /></label>} />
        <Controller control={control} name="isActive" render={({ field }) => <label className="flex items-center gap-2 text-sm">Active <Toggle checked={field.value} onChange={field.onChange} /></label>} />
      </div>
      <button hidden type="submit" />
      {save.isPending && <p className="text-xs text-slate-400">Saving…</p>}
    </form>
  );
}

export default function OffersPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState<AdminOffer | 'new' | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'offers', search, status], queryFn: () => get<{ items: AdminOffer[] }>('/admin/offers', { search, status }) });
  const options = useQuery({ queryKey: ['admin', 'product-options'], queryFn: () => get<Options>('/admin/products/options') });
  const products = useQuery({ queryKey: ['admin', 'product-options-all'], queryFn: () => get<Paginated<ProductSummary>>('/admin/products', { limit: 100, sort: 'name' }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'offers'] });
  const toggle = useMutation({ mutationFn: (o: AdminOffer) => patch(`/admin/offers/${o.id}/status`, { isActive: !o.isActive }), onSuccess: refresh, onError: (e) => notify((e as Error).message, 'error') });

  const now = Date.now();
  return (
    <AdminPage title="Offers Management" subtitle="Global and branch-specific offers" actions={can('OFFERS', 'create') && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add offer</Button>}>
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="all">All</option><option value="active">Active</option><option value="expired">Expired</option><option value="inactive">Inactive</option>
        </select>
      </div>
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        columns={[
          { key: 'title', label: 'Offer', render: (o) => (
            <div>
              <p className="font-semibold text-navy-900">{o.title} {o.isDemo && <DemoBadge label="Demo" />}</p>
              <p className="text-xs text-slate-500">{OFFER_TYPE_LABEL[o.offerType]}{o.brand ? ` · ${o.brand.name}` : ''}{o.product ? ` · ${o.product.name}` : ''}</p>
            </div>
          ) },
          { key: 'branches', label: 'Branches', render: (o) => (o.branches.length ? o.branches.map((b) => b.name).join(', ') : <span className="text-slate-400">All branches</span>) },
          { key: 'valid', label: 'Validity', render: (o) => {
            const expired = o.validTo && new Date(o.validTo).getTime() < now;
            return <span className={cn('text-xs', expired ? 'font-semibold text-rose-600' : 'text-slate-500')}>{o.validFrom ? dateFmt(o.validFrom) : 'Now'} → {o.validTo ? dateFmt(o.validTo) : 'No end'}{expired ? ' (expired)' : ''}</span>;
          } },
          { key: 'active', label: 'Active', render: (o) => <Toggle checked={o.isActive} disabled={!o.editable || !can('OFFERS', 'edit')} onChange={() => toggle.mutate(o)} /> },
          { key: 'actions', label: '', className: 'text-right', render: (o) => !o.editable ? <span title="Covers branches not assigned to you"><Lock className="ml-auto h-4 w-4 text-slate-300" /></span> : (
            <div className="flex justify-end gap-1">
              {can('OFFERS', 'edit') && <button onClick={() => setEditing(o)} className="rounded-lg p-2 text-slate-500 hover:bg-electric-50 hover:text-electric-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>}
              {can('OFFERS', 'delete') && <button onClick={async () => {
                if (!(await confirm({ title: 'Delete offer?', text: o.title, confirmLabel: 'Delete', danger: true }))) return;
                try { await del(`/admin/offers/${o.id}`); notify('Offer deleted'); refresh(); } catch (e) { notify((e as Error).message, 'error'); }
              }} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ) },
        ]}
      />
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add offer' : 'Edit offer'} size="lg" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="offer-form">Save offer</Button></>}>
        {editing !== null && options.data && (
          <OfferForm key={editing === 'new' ? 'new' : editing.id} offer={editing === 'new' ? null : editing} options={options.data} products={products.data?.items ?? []} onDone={() => { setEditing(null); refresh(); }} />
        )}
      </Modal>
    </AdminPage>
  );
}
