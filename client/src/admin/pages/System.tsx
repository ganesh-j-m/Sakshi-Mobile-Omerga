import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, KeyRound, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Pagination, PageLoader, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { ApiError, del, download, get, post, put } from '@/lib/api';
import { dateFmt, timeAgo } from '@/lib/format';
import type { BillingSettings, SeoMap } from '@/types';
import { AdminPage, DataTable, Field, Panel, SearchInput, Toggle, useConfirm } from '../components';

/* ─────────────────────────── System settings ─────────────────────────── */

const generalSchema = z.object({
  siteName: z.string().trim().min(2),
  tagline: z.string().max(160),
  defaultWhatsapp: z.string().regex(/^(\d{10,13})?$/, 'Digits only, with country code e.g. 919800000000'),
  defaultPhone: z.string().regex(/^(\d{10,13})?$/, 'Digits only'),
  email: z.union([z.string().email(), z.literal('')]),
  currency: z.literal('INR'),
  showDemoBadge: z.boolean(),
  maintenanceMode: z.boolean(),
});
type General = z.infer<typeof generalSchema>;

export function SettingsPage() {
  const qc = useQueryClient();
  const { notify } = useToast();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => get<{ general: General; seo: SeoMap; billing: BillingSettings; whatsappApi: { configured: boolean; templateName: string; language: string } }>('/admin/settings') });
  const { register, control, handleSubmit, reset, formState } = useForm<General>({ resolver: zodResolver(generalSchema) });
  useEffect(() => { if (data) reset(data.general); }, [data, reset]);
  const save = useMutation({
    mutationFn: (v: General) => put('/admin/settings/general', v),
    onSuccess: () => { notify('Settings saved'); qc.invalidateQueries({ queryKey: ['site'] }); qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  const purge = useMutation({
    mutationFn: () => post<{ removed: Record<string, number> }>('/admin/settings/purge-demo-data', { confirm: 'DELETE DEMO DATA' }),
    onSuccess: (r) => { notify(`Demo data removed: ${Object.entries(r.removed).map(([k, v]) => `${v} ${k}`).join(', ')}`); qc.invalidateQueries(); },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  if (isLoading) return <PageLoader />;
  const e = formState.errors;

  return (
    <AdminPage title="System Settings" subtitle="Business-wide configuration">
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="grid gap-6 xl:grid-cols-2">
        <Panel title="Business">
          <div className="grid gap-4">
            <Field label="Site name" error={e.siteName?.message}><input className="input" {...register('siteName')} /></Field>
            <Field label="Tagline" error={e.tagline?.message}><input className="input" {...register('tagline')} /></Field>
            <Field label="Business email" error={e.email?.message}><input className="input" type="email" {...register('email')} /></Field>
          </div>
        </Panel>
        <Panel title="WhatsApp & phone">
          <div className="grid gap-4">
            <Field label="Default WhatsApp number" error={e.defaultWhatsapp?.message} hint="Used when a branch has no WhatsApp number. Digits with country code, e.g. 91XXXXXXXXXX. Leave empty to disable WhatsApp buttons.">
              <input className="input" inputMode="numeric" {...register('defaultWhatsapp')} />
            </Field>
            <Field label="Default phone number" error={e.defaultPhone?.message}><input className="input" inputMode="numeric" {...register('defaultPhone')} /></Field>
            <Controller control={control} name="showDemoBadge" render={({ field }) => <label className="flex items-center justify-between text-sm font-medium">Show “Demo data” badges on website <Toggle checked={field.value} onChange={field.onChange} /></label>} />
          </div>
        </Panel>
        <div className="xl:col-span-2"><Button type="submit" loading={save.isPending}><Save className="h-4 w-4" /> Save settings</Button></div>
      </form>
      <Panel title="WhatsApp automatic bill sending" className="mt-6">
        {data?.whatsappApi?.configured ? (
          <p className="text-sm text-emerald-700">✅ Connected to WhatsApp Business Cloud API — every new bill is sent automatically using template <code className="rounded bg-slate-100 px-1.5">{data.whatsappApi.templateName}</code> ({data.whatsappApi.language}).</p>
        ) : (
          <p className="text-sm text-slate-600">Not connected — bills use click-to-chat (staff presses Send in WhatsApp). To send automatically, add the <code className="rounded bg-slate-100 px-1.5">WHATSAPP_*</code> values to the server <code className="rounded bg-slate-100 px-1.5">.env</code> and restart. See <b>docs/WHATSAPP_API.md</b>.</p>
        )}
      </Panel>
      <BillingSettingsPanel initial={data?.billing} />
      <Panel title="Demo data" className="mt-6 border-amber-200">
        <p className="text-sm text-slate-600">The website was seeded with clearly-labelled demo products, offers, reviews and banners. Once real data is entered, remove all demo records in one step. The Omerga branch is kept and simply marked as verified.</p>
        <Button
          variant="danger"
          className="mt-4"
          loading={purge.isPending}
          onClick={async () => { if (await confirm({ title: 'Remove all demo data?', text: 'Demo products, offers, testimonials and banners will be permanently deleted.', confirmLabel: 'Remove demo data', danger: true })) purge.mutate(); }}
        >
          <Trash2 className="h-4 w-4" /> Remove demo data
        </Button>
      </Panel>
    </AdminPage>
  );
}

/* ─────────────────────────── Billing settings ─────────────────────────── */

const billingSchema = z.object({
  businessName: z.string().trim().min(2, 'Required'),
  gstin: z.union([z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'Invalid GSTIN'), z.literal('')]),
  address: z.string().max(500),
  phone: z.string().max(40),
  email: z.union([z.string().email(), z.literal('')]),
  invoicePrefix: z.string().trim().min(1).max(8).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers or hyphen'),
  defaultGstRate: z.coerce.number().min(0).max(28),
  defaultHsn: z.string().trim().max(12).regex(/^\d*$/, 'Digits only'),
  pricesIncludeGst: z.boolean(),
  terms: z.string().max(2000),
  footerNote: z.string().max(300),
});
type BillingValues = z.input<typeof billingSchema>;

function BillingSettingsPanel({ initial }: { initial?: BillingSettings }) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const { register, control, handleSubmit, reset, formState } = useForm<BillingValues>({ resolver: zodResolver(billingSchema) });
  useEffect(() => { if (initial) reset(initial); }, [initial, reset]);
  const save = useMutation({
    mutationFn: (v: z.output<typeof billingSchema>) => put('/admin/settings/billing', v),
    onSuccess: () => { notify('Billing settings saved'); qc.invalidateQueries({ queryKey: ['admin', 'billing-settings'] }); qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  const e = formState.errors;
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v as z.output<typeof billingSchema>))} className="mt-6">
      <Panel title="Billing & invoice">
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Enter your verified GSTIN, HSN code and GST rate as advised by your CA. When GSTIN is empty, bills are printed as a plain “INVOICE” instead of “TAX INVOICE”.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Business name on bill" error={e.businessName?.message}><input className="input" {...register('businessName')} /></Field>
          <Field label="GSTIN" error={e.gstin?.message}><input className="input uppercase" {...register('gstin')} /></Field>
          <Field label="Address on bill (empty = branch address)" className="md:col-span-2"><textarea rows={2} className="input" {...register('address')} /></Field>
          <Field label="Phone on bill"><input className="input" {...register('phone')} /></Field>
          <Field label="Email on bill" error={e.email?.message}><input className="input" {...register('email')} /></Field>
          <Field label="Invoice prefix" error={e.invoicePrefix?.message} hint="Bill no. format: PREFIX/BRANCH-CODE/FY/00001"><input className="input uppercase" {...register('invoicePrefix')} /></Field>
          <Field label="Default GST rate (%)" error={e.defaultGstRate?.message}><input className="input" type="number" min={0} max={28} step="0.01" {...register('defaultGstRate')} /></Field>
          <Field label="Default HSN code" error={e.defaultHsn?.message}><input className="input" {...register('defaultHsn')} /></Field>
          <Controller control={control} name="pricesIncludeGst" render={({ field }) => (
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium">Prices entered include GST <Toggle checked={Boolean(field.value)} onChange={field.onChange} /></label>
          )} />
          <Field label="Terms & conditions" className="md:col-span-2"><textarea rows={3} className="input" {...register('terms')} /></Field>
          <Field label="Footer note" className="md:col-span-2"><input className="input" {...register('footerNote')} /></Field>
        </div>
        <Button type="submit" className="mt-4" loading={save.isPending}><Save className="h-4 w-4" /> Save billing settings</Button>
      </Panel>
    </form>
  );
}

/* ─────────────────────────────── SEO ─────────────────────────────── */

export function SeoPage() {
  const qc = useQueryClient();
  const { notify } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => get<{ seo: SeoMap }>('/admin/settings') });
  const [rows, setRows] = useState<{ route: string; title: string; description: string; ogImage: string }[]>([]);
  useEffect(() => {
    if (data) setRows(Object.entries(data.seo).map(([route, v]) => ({ route, title: v.title ?? '', description: v.description ?? '', ogImage: v.ogImage ?? '' })));
  }, [data]);
  const save = useMutation({
    mutationFn: () => put('/admin/settings/seo', Object.fromEntries(rows.filter((r) => r.route).map((r) => [r.route, { title: r.title || undefined, description: r.description || undefined, ogImage: r.ogImage || undefined }]))),
    onSuccess: () => { notify('SEO settings saved'); qc.invalidateQueries({ queryKey: ['site'] }); },
    onError: (e) => notify(e instanceof ApiError ? `${e.message}: ${Object.values(e.fieldErrors).join(', ')}` : (e as Error).message, 'error'),
  });
  const upd = (i: number, k: keyof (typeof rows)[number], v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  if (isLoading) return <PageLoader />;
  return (
    <AdminPage
      title="SEO Management"
      subtitle="Override meta title & description for any page route. Product, brand and branch pages also generate SEO automatically. Sitemap: /sitemap.xml"
      actions={<><Button variant="outline" onClick={() => setRows((r) => [...r, { route: '/', title: '', description: '', ogImage: '' }])}><Plus className="h-4 w-4" /> Add route</Button><Button loading={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4" /> Save</Button></>}
    >
      <div className="space-y-4">
        {rows.map((r, i) => (
          <Panel key={i}>
            <div className="grid gap-3 md:grid-cols-[200px_1fr_auto]">
              <Field label="Route"><input className="input font-mono text-xs" value={r.route} onChange={(e) => upd(i, 'route', e.target.value)} placeholder="/mobiles" /></Field>
              <div className="grid gap-3">
                <Field label={`Meta title (${r.title.length}/60 recommended)`}><input className="input" value={r.title} onChange={(e) => upd(i, 'title', e.target.value)} /></Field>
                <Field label={`Meta description (${r.description.length}/160 recommended)`}><textarea rows={2} className="input" value={r.description} onChange={(e) => upd(i, 'description', e.target.value)} /></Field>
                <Field label="Open Graph image URL"><input className="input" value={r.ogImage} onChange={(e) => upd(i, 'ogImage', e.target.value)} /></Field>
              </div>
              <button onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="self-start rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
            </div>
          </Panel>
        ))}
      </div>
    </AdminPage>
  );
}

/* ─────────────────────────── Activity logs ─────────────────────────── */

type Log = { id: number; action: string; entity: string; entityId: string | null; details: Record<string, unknown> | null; ipAddress: string | null; createdAt: string; loginId: string | null };

export function ActivityLogsPage() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logs', search, entity, page],
    queryFn: () => get<{ items: Log[]; entities: string[]; pagination: { page: number; totalPages: number } }>('/admin/activity-logs', { search, entity, page }),
    placeholderData: keepPreviousData,
  });
  return (
    <AdminPage title="Activity Logs" subtitle="Audit trail of every admin action">
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Action, entity or user…" />
        <select className="input w-auto" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Entity">
          <option value="">All entities</option>
          {data?.entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <DataTable
        rows={data?.items ?? []}
        loading={isLoading}
        columns={[
          { key: 'when', label: 'When', render: (l) => <span className="whitespace-nowrap text-xs text-slate-500" title={dateFmt(l.createdAt, true)}>{timeAgo(l.createdAt)}</span> },
          { key: 'user', label: 'User', render: (l) => <span className="font-medium">{l.loginId ?? '—'}</span> },
          { key: 'action', label: 'Action', render: (l) => <span className="chip bg-violet-50 text-violet-700">{l.action}</span> },
          { key: 'entity', label: 'Entity', render: (l) => `${l.entity}${l.entityId ? ` #${l.entityId}` : ''}` },
          { key: 'details', label: 'Details', render: (l) => <code className="line-clamp-1 max-w-xs text-xs text-slate-500">{l.details ? JSON.stringify(l.details) : ''}</code> },
          { key: 'ip', label: 'IP', render: (l) => <span className="text-xs text-slate-400">{l.ipAddress}</span> },
        ]}
      />
      {data && <div className="mt-6"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} /></div>}
    </AdminPage>
  );
}

/* ─────────────────────────────── Backups ─────────────────────────────── */

export function BackupsPage() {
  const qc = useQueryClient();
  const { notify } = useToast();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'backups'], queryFn: () => get<{ items: { name: string; size: number; createdAt: string }[]; retention: number; directory: string }>('/admin/backups') });
  const create = useMutation({
    mutationFn: () => post('/admin/backups'),
    onSuccess: () => { notify('Backup created'); qc.invalidateQueries({ queryKey: ['admin', 'backups'] }); },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  return (
    <AdminPage title="Database Backups" subtitle={data ? `Keeps the latest ${data.retention} backups in ${data.directory}` : undefined} actions={<Button loading={create.isPending} onClick={() => create.mutate()}><DatabaseBackup className="h-4 w-4" /> Create backup now</Button>}>
      <DataTable
        rows={(data?.items ?? []).map((b) => ({ ...b, id: b.name }))}
        loading={isLoading}
        empty="No backups yet"
        columns={[
          { key: 'name', label: 'File', render: (b) => <code className="text-xs">{b.name}</code> },
          { key: 'size', label: 'Size', render: (b) => `${(b.size / 1024 / 1024).toFixed(2)} MB` },
          { key: 'date', label: 'Created', render: (b) => dateFmt(b.createdAt, true) },
          { key: 'a', label: '', className: 'text-right', render: (b) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => download(`/admin/backups/${b.name}`).catch((e) => notify(e.message, 'error'))} className="rounded-lg p-2 text-slate-500 hover:bg-electric-50 hover:text-electric-600" aria-label="Download"><Download className="h-4 w-4" /></button>
              <button onClick={async () => { if (await confirm({ title: 'Delete backup?', text: b.name, danger: true, confirmLabel: 'Delete' })) { await del(`/admin/backups/${b.name}`); qc.invalidateQueries({ queryKey: ['admin', 'backups'] }); } }} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
            </div>
          ) },
        ]}
      />
      <Panel title="Restore & automation" className="mt-6">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Backups use PostgreSQL custom format. Restore with: <code className="rounded bg-slate-100 px-1.5">pg_restore --clean --no-owner -d "$DATABASE_URL" file.dump</code></li>
          <li>Schedule daily backups with cron: <code className="rounded bg-slate-100 px-1.5">0 2 * * * cd /app/server && node dist/scripts/backup.js</code></li>
          <li>Copy backups off the server regularly (e.g. to cloud storage). See BACKUP.md in the project.</li>
        </ul>
      </Panel>
    </AdminPage>
  );
}

/* ─────────────────────────────── Account ─────────────────────────────── */

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(10, 'At least 10 characters').regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a number').regex(/[^A-Za-z0-9]/, 'Add a special character'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export function AccountPage() {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setError, formState } = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });
  const save = useMutation({
    mutationFn: (v: z.infer<typeof pwSchema>) => post('/auth/change-password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: () => { notify('Password changed. Other devices have been signed out.'); reset(); setOpen(false); },
    onError: (e) => { if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as 'currentPassword', { message: m }); notify((e as Error).message, 'error'); },
  });
  return (
    <AdminPage title="My Account">
      <Panel title="Security">
        <p className="text-sm text-slate-600">Use a strong, unique password. Changing it signs out all other sessions.</p>
        <Button className="mt-4" onClick={() => setOpen(true)}><KeyRound className="h-4 w-4" /> Change password</Button>
      </Panel>
      <Modal open={open} onClose={() => setOpen(false)} title="Change password" size="sm" footer={<Button type="submit" form="pw-form" loading={save.isPending}>Update password</Button>}>
        <form id="pw-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <Field label="Current password" error={formState.errors.currentPassword?.message}><input type="password" autoComplete="current-password" className="input" {...register('currentPassword')} /></Field>
          <Field label="New password" error={formState.errors.newPassword?.message}><input type="password" autoComplete="new-password" className="input" {...register('newPassword')} /></Field>
          <Field label="Confirm new password" error={formState.errors.confirm?.message}><input type="password" autoComplete="new-password" className="input" {...register('confirm')} /></Field>
        </form>
      </Modal>
    </AdminPage>
  );
}
