import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Modal, PageLoader } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { ApiError, del, get, patch, post, put } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateFmt, timeAgo } from '@/lib/format';
import type { PermissionFlags } from '@/types';
import { AdminPage, DataTable, Field, Toggle, useConfirm } from '../components';

type AdminRow = { id: number; loginId: string; email: string | null; role: 'SUPER_ADMIN' | 'ADMIN'; isActive: boolean; lastLoginAt: string | null; createdAt: string; fullName: string | null; designation: string | null; phone: string | null; branchCount: number };
type ListResp = { items: AdminRow[]; modules: string[]; defaultPermissions: Record<string, PermissionFlags> };
type Detail = { id: number; loginId: string; email: string | null; role: string; profile: { fullName: string; phone: string | null; designation: string | null } | null; permissions: Record<string, PermissionFlags>; branchIds: number[] };

const MODULE_LABEL: Record<string, string> = {
  PRODUCTS: 'Products', BRANDS: 'Brands', CATEGORIES: 'Categories', OFFERS: 'Offers', BRANCHES: 'Branches', BRANCH_PRODUCTS: 'Branch availability',
  INQUIRIES: 'Inquiries', CMS: 'Website content', BANNERS: 'Banners', TESTIMONIALS: 'Testimonials', REPORTS: 'Reports', BILLING: 'Billing (view / bill / cancel)',
};
const ACTIONS: (keyof PermissionFlags)[] = ['view', 'create', 'edit', 'delete'];
const pw = z.string().min(10, 'At least 10 characters').regex(/[a-z]/, 'Add lowercase').regex(/[A-Z]/, 'Add uppercase').regex(/\d/, 'Add a number').regex(/[^A-Za-z0-9]/, 'Add a symbol');

const schema = z.object({
  loginId: z.string().trim().min(4, 'At least 4 characters').regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, . _ - only'),
  password: z.union([pw, z.literal('')]),
  fullName: z.string().trim().min(2, 'Required'),
  email: z.union([z.string().email(), z.literal('')]),
  phone: z.string().optional(),
  designation: z.string().optional(),
  permissions: z.record(z.object({ view: z.boolean(), create: z.boolean(), edit: z.boolean(), delete: z.boolean() })),
  branchIds: z.array(z.number()),
});
type Values = z.infer<typeof schema>;

function AdminForm({ meta, editing, onDone }: { meta: ListResp; editing: Detail | null; onDone: () => void }) {
  const { notify } = useToast();
  const branches = useQuery({ queryKey: ['admin', 'branches', ''], queryFn: () => get<{ items: { id: number; name: string; code: string }[] }>('/admin/branches') });
  const { register, control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(editing ? schema.extend({ password: z.literal('').or(z.string()).optional() }) : schema.refine((v) => v.password !== '', { path: ['password'], message: 'Password is required' })),
    defaultValues: editing
      ? { loginId: editing.loginId, password: '', fullName: editing.profile?.fullName ?? '', email: editing.email ?? '', phone: editing.profile?.phone ?? '', designation: editing.profile?.designation ?? '', permissions: Object.fromEntries(meta.modules.map((m) => [m, editing.permissions[m] ?? { view: false, create: false, edit: false, delete: false }])), branchIds: editing.branchIds }
      : { loginId: '', password: '', fullName: '', email: '', phone: '', designation: '', permissions: meta.defaultPermissions, branchIds: [] },
  });
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, phone: v.phone || null, designation: v.designation || null, email: v.email || null };
      return editing ? put(`/admin/users/${editing.id}`, body) : post('/admin/users', body);
    },
    onSuccess: () => { notify(editing ? 'Admin updated' : 'Admin account created'); onDone(); },
    onError: (e) => { if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as keyof Values, { message: m }); notify((e as Error).message, 'error'); },
  });
  const e = formState.errors;
  return (
    <form id="admin-form" onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *" error={e.fullName?.message}><input className="input" {...register('fullName')} /></Field>
        <Field label="Login ID *" error={e.loginId?.message}><input className="input" disabled={!!editing} autoComplete="off" {...register('loginId')} /></Field>
        {!editing && <Field label="Temporary password *" error={e.password?.message} hint="Min 10 chars with upper, lower, number & symbol"><input className="input" type="password" autoComplete="new-password" {...register('password')} /></Field>}
        <Field label="Email" error={e.email?.message}><input className="input" type="email" {...register('email')} /></Field>
        <Field label="Phone"><input className="input" {...register('phone')} /></Field>
        <Field label="Designation"><input className="input" placeholder="Branch manager" {...register('designation')} /></Field>
      </div>
      <div>
        <p className="label">Assigned branches</p>
        <Controller control={control} name="branchIds" render={({ field }) => (
          <div className="flex flex-wrap gap-2">
            {branches.data?.items.map((b) => {
              const on = field.value.includes(b.id);
              return <button type="button" key={b.id} onClick={() => field.onChange(on ? field.value.filter((x) => x !== b.id) : [...field.value, b.id])} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium transition', on ? 'bg-navy-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{b.name}</button>;
            })}
          </div>
        )} />
        <p className="mt-1 text-xs text-slate-400">Admins can only manage branch data, availability, offers and inquiries for these branches.</p>
      </div>
      <div>
        <p className="label">Module permissions</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Module</th>{ACTIONS.map((a) => <th key={a} className="px-3 py-2 capitalize">{a}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {meta.modules.map((m) => (
                <tr key={m}>
                  <td className="px-3 py-2 font-medium text-navy-900">{MODULE_LABEL[m] ?? m}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-3 py-2 text-center">
                      <Controller control={control} name={`permissions.${m}.${a}`} render={({ field }) => <input type="checkbox" checked={Boolean(field.value)} onChange={(ev) => field.onChange(ev.target.checked)} className="h-4 w-4 accent-violet-600" aria-label={`${m} ${a}`} />} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button hidden type="submit" />
    </form>
  );
}

export default function AdminsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Detail | 'new' | null>(null);
  const [resetFor, setResetFor] = useState<AdminRow | null>(null);
  const [newPw, setNewPw] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<ListResp>('/admin/users') });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  const toggle = useMutation({ mutationFn: (a: AdminRow) => patch(`/admin/users/${a.id}/status`, { isActive: !a.isActive }), onSuccess: refresh, onError: (e) => notify((e as Error).message, 'error') });
  const resetPw = useMutation({
    mutationFn: () => post(`/admin/users/${resetFor!.id}/reset-password`, { password: newPw }),
    onSuccess: () => { notify('Password reset. The admin has been signed out everywhere.'); setResetFor(null); setNewPw(''); },
    onError: (e) => notify(e instanceof ApiError ? Object.values(e.fieldErrors)[0] ?? e.message : (e as Error).message, 'error'),
  });

  if (isLoading || !data) return <PageLoader />;
  return (
    <AdminPage title="Admin Management" subtitle="Create admin accounts, assign branches and permissions" actions={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New admin</Button>}>
      <DataTable
        rows={data.items}
        columns={[
          { key: 'name', label: 'Name', render: (a) => (
            <div className="flex items-center gap-3">
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white', a.role === 'SUPER_ADMIN' ? 'bg-gradient-to-br from-flame-500 to-rose-500' : 'bg-gradient-to-br from-electric-500 to-violet-500')}>{(a.fullName ?? a.loginId)[0]?.toUpperCase()}</span>
              <div><p className="font-semibold text-navy-900">{a.fullName ?? a.loginId}</p><p className="text-xs text-slate-500">{a.loginId}{a.designation ? ` · ${a.designation}` : ''}</p></div>
            </div>
          ) },
          { key: 'role', label: 'Role', render: (a) => a.role === 'SUPER_ADMIN' ? <span className="chip bg-flame-50 text-flame-700"><ShieldCheck className="h-3 w-3" /> Super Admin</span> : <span className="chip bg-electric-50 text-electric-700">Admin</span> },
          { key: 'branches', label: 'Branches', render: (a) => (a.role === 'SUPER_ADMIN' ? 'All' : a.branchCount) },
          { key: 'login', label: 'Last login', render: (a) => <span className="text-xs text-slate-500" title={dateFmt(a.lastLoginAt, true)}>{a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'Never'}</span> },
          { key: 'active', label: 'Active', render: (a) => <Toggle checked={a.isActive} disabled={a.role === 'SUPER_ADMIN' || a.id === user?.id} onChange={() => toggle.mutate(a)} /> },
          { key: 'actions', label: '', className: 'text-right', render: (a) => (
            <div className="flex justify-end gap-1">
              <button onClick={async () => setEditing((await get<{ item: Detail }>(`/admin/users/${a.id}`)).item)} className="rounded-lg p-2 text-slate-500 hover:bg-electric-50 hover:text-electric-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => setResetFor(a)} className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-600" aria-label="Reset password"><KeyRound className="h-4 w-4" /></button>
              {a.role === 'ADMIN' && <button onClick={async () => {
                if (!(await confirm({ title: 'Delete admin account?', text: `${a.loginId} will lose access immediately.`, danger: true, confirmLabel: 'Delete' }))) return;
                try { await del(`/admin/users/${a.id}`); notify('Admin deleted'); refresh(); } catch (e) { notify((e as Error).message, 'error'); }
              }} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
            </div>
          ) },
        ]}
      />
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Create admin' : 'Edit admin'} size="lg" footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" form="admin-form">Save</Button></>}>
        {editing !== null && <AdminForm key={editing === 'new' ? 'new' : editing.id} meta={data} editing={editing === 'new' ? null : editing} onDone={() => { setEditing(null); refresh(); }} />}
      </Modal>
      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password — ${resetFor?.loginId ?? ''}`} size="sm" footer={<Button loading={resetPw.isPending} disabled={newPw.length < 10} onClick={() => resetPw.mutate()}>Reset password</Button>}>
        <Field label="New password" hint="Min 10 chars with upper, lower, number & symbol. Share it securely."><input type="password" autoComplete="new-password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
      </Modal>
    </AdminPage>
  );
}
