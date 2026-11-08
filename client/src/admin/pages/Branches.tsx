import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Boxes, ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, DemoBadge, LinkButton, PageLoader } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { ApiError, del, get, patch, post, put } from '@/lib/api';
import { cn } from '@/lib/cn';
import { BRANCH_TYPE_LABEL } from '@/lib/format';
import type { Branch } from '@/types';
import { AdminPage, DataTable, Field, ImageInput, Panel, SearchInput, Toggle, useConfirm } from '../components';

type BranchRow = Pick<Branch, 'id' | 'code' | 'slug' | 'name' | 'type' | 'city' | 'district' | 'phone' | 'whatsapp' | 'imageUrl' | 'isDemo'> & {
  isActive: boolean;
  productCount: number;
  offerCount: number;
  newInquiries: number;
};

export function BranchesList({ base }: { base: string }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'branches', search], queryFn: () => get<{ items: BranchRow[] }>('/admin/branches', { search }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
  const toggle = useMutation({ mutationFn: (b: BranchRow) => patch(`/admin/branches/${b.id}/status`, { isActive: !b.isActive }), onSuccess: refresh, onError: (e) => notify((e as Error).message, 'error') });

  return (
    <AdminPage title="Branch Management" subtitle="New branches appear on the website automatically when active" actions={can('BRANCHES', 'create') && <LinkButton to={`${base}/branches/new`}><Plus className="h-4 w-4" /> Add branch</LinkButton>}>
      <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Search name, code, city…" /></div>
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        columns={[
          { key: 'name', label: 'Branch', render: (b) => (
            <div>
              <p className="font-semibold text-navy-900">{b.name} {b.isDemo && <DemoBadge label="Unverified" />}</p>
              <p className="text-xs text-slate-500">{b.code} · {BRANCH_TYPE_LABEL[b.type]} · {b.city}</p>
            </div>
          ) },
          { key: 'contact', label: 'Contact', render: (b) => <span className="text-xs text-slate-600">{b.phone || <span className="text-amber-600">No phone</span>}<br />{b.whatsapp ? `WA: ${b.whatsapp}` : <span className="text-amber-600">No WhatsApp</span>}</span> },
          { key: 'stats', label: 'Products / Offers', render: (b) => `${b.productCount} / ${b.offerCount}` },
          { key: 'inq', label: 'New inquiries', render: (b) => (b.newInquiries ? <span className="chip bg-rose-50 text-rose-600">{b.newInquiries}</span> : '—') },
          { key: 'active', label: 'Active', render: (b) => <Toggle checked={b.isActive} disabled={!can('BRANCHES', 'edit')} onChange={() => toggle.mutate(b)} /> },
          { key: 'actions', label: '', className: 'text-right', render: (b) => (
            <div className="flex justify-end gap-1">
              <a href={`/branches/${b.slug}`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="View on site"><ExternalLink className="h-4 w-4" /></a>
              {can('BRANCH_PRODUCTS') && <Link to={`${base}/branch-products?branch=${b.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-600" aria-label="Assign products"><Boxes className="h-4 w-4" /></Link>}
              {can('BRANCHES', 'edit') && <Link to={`${base}/branches/${b.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-electric-50 hover:text-electric-600" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>}
              {can('BRANCHES', 'delete') && <button onClick={async () => {
                if (!(await confirm({ title: 'Delete branch?', text: `${b.name} will be removed from the website.`, confirmLabel: 'Delete', danger: true }))) return;
                try { await del(`/admin/branches/${b.id}`); notify('Branch deleted'); refresh(); } catch (e) { notify((e as Error).message, 'error'); }
              }} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ) },
        ]}
      />
    </AdminPage>
  );
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const time = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, 'HH:MM');
const schema = z.object({
  code: z.string().trim().min(2, 'Branch code is required').max(20),
  name: z.string().trim().min(2, 'Name is required').max(150),
  slug: z.string().max(120).optional(),
  type: z.enum(['MAIN', 'BRANCH', 'FRANCHISE', 'SERVICE_CENTER']),
  imageUrl: z.string().nullable().optional(),
  intro: z.string().max(3000).optional().nullable(),
  addressLine: z.string().max(500).optional().nullable(),
  city: z.string().trim().min(2, 'City is required'),
  district: z.string().optional().nullable(),
  state: z.string().trim().min(2),
  pincode: z.string().regex(/^(\d{6})?$/, '6 digits').optional().nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  mapsUrl: z.string().optional().nullable(),
  latitude: z.union([z.coerce.number().min(-90).max(90), z.literal('')]).optional().nullable(),
  longitude: z.union([z.coerce.number().min(-180).max(180), z.literal('')]).optional().nullable(),
  openingHours: z.array(z.object({ day: z.string(), open: time, close: time, closed: z.boolean() })),
  services: z.array(z.object({ value: z.string() })),
  brandIds: z.array(z.number()),
  offerIds: z.array(z.number()),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
});
type Values = z.input<typeof schema>;

export function BranchForm({ base }: { base: string }) {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notify } = useToast();
  const { can } = useAuth();
  const existing = useQuery({ queryKey: ['admin', 'branch', id], queryFn: () => get<{ item: Branch & { brandIds: number[]; offerIds: number[]; isActive: boolean; sortOrder: number } }>(`/admin/branches/${id}`), enabled: !isNew });
  const brands = useQuery({ queryKey: ['admin', 'brands-all'], queryFn: () => get<{ items: { id: number; name: string }[] }>('/admin/brands', { limit: 200 }), enabled: can('BRANDS') });
  const offers = useQuery({ queryKey: ['admin', 'offers', '', 'all'], queryFn: () => get<{ items: { id: number; title: string }[] }>('/admin/offers'), enabled: can('OFFERS') });
  const [service, setService] = useState('');

  const { register, control, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'BRANCH', state: 'Maharashtra', isActive: true, sortOrder: 0, brandIds: [], offerIds: [], services: [],
      openingHours: DAYS.map((day) => ({ day, open: '10:00', close: '21:00', closed: false })),
    },
  });
  const hours = useFieldArray({ control, name: 'openingHours' });
  const services = useFieldArray({ control, name: 'services' });

  useEffect(() => {
    const b = existing.data?.item;
    if (!b) return;
    reset({
      code: b.code, name: b.name, slug: b.slug, type: b.type, imageUrl: b.imageUrl, intro: b.intro ?? '', addressLine: b.addressLine ?? '',
      city: b.city, district: b.district ?? '', state: b.state, pincode: b.pincode ?? '', phone: b.phone ?? '', whatsapp: b.whatsapp ?? '', email: b.email ?? '',
      mapsUrl: b.mapsUrl ?? '', latitude: b.latitude ?? '', longitude: b.longitude ?? '',
      openingHours: DAYS.map((day) => {
        const h = b.openingHours.find((x) => x.day === day);
        return { day, open: h?.open ?? '', close: h?.close ?? '', closed: Boolean(h?.closed) };
      }),
      services: b.services.map((value) => ({ value })), brandIds: b.brandIds, offerIds: b.offerIds, isActive: b.isActive, sortOrder: b.sortOrder,
    });
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (v: z.output<typeof schema>) => {
      const body = { ...v, services: v.services.map((s) => s.value), latitude: v.latitude === '' ? null : v.latitude, longitude: v.longitude === '' ? null : v.longitude };
      return isNew ? post('/admin/branches', body) : put(`/admin/branches/${id}`, body);
    },
    onSuccess: () => {
      notify(isNew ? 'Branch created — it is now live on the website' : 'Branch updated');
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate(`${base}/branches`);
    },
    onError: (e) => {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as keyof Values, { message: m });
      notify((e as Error).message, 'error');
    },
  });

  if (!isNew && existing.isLoading) return <PageLoader />;
  const err = (k: keyof Values) => formState.errors[k]?.message as string | undefined;

  const multi = (name: 'brandIds' | 'offerIds', items: { id: number; label: string }[]) => (
    <Controller control={control} name={name} render={({ field }) => (
      <div className="flex flex-wrap gap-2">
        {items.map((it) => {
          const on = field.value.includes(it.id);
          return <button type="button" key={it.id} onClick={() => field.onChange(on ? field.value.filter((x) => x !== it.id) : [...field.value, it.id])} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium transition', on ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{it.label}</button>;
        })}
        {items.length === 0 && <span className="text-sm text-slate-400">Nothing to select</span>}
      </div>
    )} />
  );

  return (
    <AdminPage title={isNew ? 'Add branch' : 'Edit branch'} actions={<Link to={`${base}/branches`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft className="h-4 w-4" /> Back</Link>}>
      <form onSubmit={handleSubmit((v) => save.mutate(v as z.output<typeof schema>))} className="grid gap-6 xl:grid-cols-[1fr_380px]" noValidate>
        <div className="space-y-6">
          <Panel title="Branch details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch name *" error={err('name')} className="sm:col-span-2"><input className="input" {...register('name')} /></Field>
              <Field label="Branch code *" error={err('code')} hint="e.g. OMG-01"><input className="input uppercase" {...register('code')} /></Field>
              <Field label="Branch type"><select className="input" {...register('type')}>{Object.entries(BRANCH_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Page URL" hint="e.g. omerga → /branches/omerga" className="sm:col-span-2"><input className="input" {...register('slug')} /></Field>
              <Field label="Introduction" className="sm:col-span-2"><textarea rows={4} className="input" {...register('intro')} /></Field>
              <div className="sm:col-span-2"><Controller control={control} name="imageUrl" render={({ field }) => <ImageInput label="Branch photo" folder="branches" value={field.value} onChange={field.onChange} />} /></div>
            </div>
          </Panel>
          <Panel title="Address & location">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full address" className="sm:col-span-2"><textarea rows={2} className="input" {...register('addressLine')} /></Field>
              <Field label="City *" error={err('city')}><input className="input" {...register('city')} /></Field>
              <Field label="District"><input className="input" {...register('district')} /></Field>
              <Field label="State *" error={err('state')}><input className="input" {...register('state')} /></Field>
              <Field label="Pincode" error={err('pincode')}><input className="input" inputMode="numeric" {...register('pincode')} /></Field>
              <Field label="Google Maps URL" className="sm:col-span-2"><input className="input" {...register('mapsUrl')} /></Field>
              <Field label="Latitude" error={err('latitude')}><input className="input" {...register('latitude')} /></Field>
              <Field label="Longitude" error={err('longitude')}><input className="input" {...register('longitude')} /></Field>
            </div>
          </Panel>
          <Panel title="Opening hours">
            <div className="space-y-2">
              {hours.fields.map((h, i) => (
                <div key={h.id} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-2 text-sm">
                  <span className="font-medium text-navy-900">{h.day}</span>
                  <input type="time" className="input py-2" {...register(`openingHours.${i}.open`)} />
                  <input type="time" className="input py-2" {...register(`openingHours.${i}.close`)} />
                  <Controller control={control} name={`openingHours.${i}.closed`} render={({ field }) => <label className="flex items-center gap-2 text-xs text-slate-500">Closed <Toggle checked={field.value} onChange={field.onChange} /></label>} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Available services">
            <div className="mb-3 flex flex-wrap gap-2">
              {services.fields.map((s, i) => (
                <span key={s.id} className="chip bg-violet-50 py-1.5 text-violet-700">{s.value}<button type="button" onClick={() => services.remove(i)} aria-label="Remove"><X className="h-3 w-3" /></button></span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input" value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Screen guard fitting" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (service.trim()) { services.append({ value: service.trim() }); setService(''); } } }} />
              <Button type="button" variant="outline" onClick={() => { if (service.trim()) { services.append({ value: service.trim() }); setService(''); } }}>Add</Button>
            </div>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="Contact">
            <div className="space-y-4">
              <Field label="Contact number" error={err('phone')}><input className="input" inputMode="tel" {...register('phone')} /></Field>
              <Field label="WhatsApp number" hint="Used for this branch’s WhatsApp buttons"><input className="input" inputMode="tel" {...register('whatsapp')} /></Field>
              <Field label="Email" error={err('email')}><input className="input" type="email" {...register('email')} /></Field>
            </div>
          </Panel>
          <Panel title="Brands available">{multi('brandIds', (brands.data?.items ?? []).map((b) => ({ id: b.id, label: b.name })))}</Panel>
          <Panel title="Branch-specific offers">{multi('offerIds', (offers.data?.items ?? []).map((o) => ({ id: o.id, label: o.title })))}</Panel>
          <Panel title="Visibility">
            <div className="space-y-4">
              <Controller control={control} name="isActive" render={({ field }) => <label className="flex items-center justify-between text-sm font-medium">Active (shown on website) <Toggle checked={field.value} onChange={field.onChange} /></label>} />
              <Field label="Display order"><input type="number" min={0} className="input" {...register('sortOrder')} /></Field>
            </div>
          </Panel>
          <Button type="submit" size="lg" className="sticky bottom-4 w-full" loading={save.isPending}><Save className="h-5 w-5" /> Save branch</Button>
        </div>
      </form>
    </AdminPage>
  );
}
