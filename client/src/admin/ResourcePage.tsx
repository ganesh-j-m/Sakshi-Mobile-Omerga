import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z, type ZodTypeAny } from 'zod';
import { Button, Modal, Pagination } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { ApiError, del, get, patch, post, put } from '@/lib/api';
import type { Paginated } from '@/types';
import { AdminPage, DataTable, Field, ImageInput, SearchInput, Toggle, useConfirm, type Column } from './components';

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'image' | 'color' | 'datetime';
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  full?: boolean;
  folder?: string;
  default?: unknown;
  min?: number;
  max?: number;
};

export type ResourceConfig<T> = {
  title: string;
  subtitle?: string;
  endpoint: string;
  module: string;
  singular: string;
  columns: Column<T>[];
  fields: FieldDef[];
  extraFilters?: (set: (k: string, v: string) => void, values: Record<string, string>) => ReactNode;
  hasStatus?: boolean;
};

type Row = { id: number; isActive?: boolean } & Record<string, unknown>;

function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) {
    let s: ZodTypeAny;
    switch (f.type) {
      case 'checkbox':
        s = z.boolean();
        break;
      case 'number':
        s = z.union([z.coerce.number().min(f.min ?? -Infinity).max(f.max ?? Infinity), z.literal('')]);
        if (f.required) s = z.coerce.number({ invalid_type_error: 'Required' }).min(f.min ?? -Infinity).max(f.max ?? Infinity);
        break;
      case 'color':
        s = f.required ? z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB') : z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB'), z.literal('')]);
        break;
      default:
        s = z.preprocess(
          (v) => (v == null ? '' : String(v)),
          f.required ? z.string().trim().min(1, `${f.label} is required`) : z.string(),
        );
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}

const toLocalInput = (v: unknown) => {
  if (!v) return '';
  const d = new Date(String(v));
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function defaults(fields: FieldDef[], row?: Row | null) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = row?.[f.name];
    if (f.type === 'checkbox') out[f.name] = row ? Boolean(v) : (f.default ?? true);
    else if (f.type === 'datetime') out[f.name] = toLocalInput(v);
    else out[f.name] = v ?? f.default ?? '';
  }
  return out;
}

function serialize(fields: FieldDef[], values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'number') out[f.name] = v === '' || v == null ? (f.required ? 0 : null) : Number(v);
    else if (f.type === 'datetime') out[f.name] = v ? new Date(String(v)).toISOString() : null;
    else if (f.type === 'checkbox') out[f.name] = Boolean(v);
    else out[f.name] = v === '' ? null : v;
  }
  return out;
}

export function ResourceForm({ fields, initial, onSubmit, submitting, serverErrors }: { fields: FieldDef[]; initial?: Row | null; onSubmit: (v: Record<string, unknown>) => void; submitting: boolean; serverErrors?: Record<string, string> }) {
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const { register, control, handleSubmit, formState } = useForm({ resolver: zodResolver(schema), defaultValues: defaults(fields, initial) });
  const err = (n: string) => (formState.errors[n]?.message as string | undefined) ?? serverErrors?.[n];

  return (
    <form id="resource-form" onSubmit={handleSubmit((v) => onSubmit(serialize(fields, v)))} className="grid gap-4 sm:grid-cols-2" noValidate>
      {fields.map((f) => {
        const cls = f.full || f.type === 'textarea' || f.type === 'image' ? 'sm:col-span-2' : '';
        if (f.type === 'checkbox')
          return (
            <Controller
              key={f.name}
              control={control}
              name={f.name}
              render={({ field }) => (
                <label className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 ${cls}`}>
                  <span className="text-sm font-medium text-navy-900">{f.label}</span>
                  <Toggle checked={Boolean(field.value)} onChange={field.onChange} label={f.label} />
                </label>
              )}
            />
          );
        if (f.type === 'image')
          return (
            <Controller
              key={f.name}
              control={control}
              name={f.name}
              render={({ field }) => (
                <div className={cls}>
                  <ImageInput label={f.label} folder={f.folder ?? 'misc'} value={field.value as string} onChange={field.onChange} />
                  {err(f.name) && <p className="mt-1 text-xs text-rose-500">{err(f.name)}</p>}
                </div>
              )}
            />
          );
        return (
          <Field key={f.name} label={`${f.label}${f.required ? ' *' : ''}`} error={err(f.name)} hint={f.hint} className={cls}>
            {f.type === 'textarea' ? (
              <textarea rows={4} className="input" {...register(f.name)} />
            ) : f.type === 'select' ? (
              <select className="input" {...register(f.name)}>
                {!f.required && <option value="">—</option>}
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'color' ? (
              <Controller
                control={control}
                name={f.name}
                render={({ field }) => (
                  <div className="flex gap-2">
                    <input type="color" value={(field.value as string) || '#2563FF'} onChange={field.onChange} className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200" aria-label={f.label} />
                    <input className="input" value={(field.value as string) ?? ''} onChange={field.onChange} placeholder="#2563FF" />
                  </div>
                )}
              />
            ) : (
              <input className="input" type={f.type === 'number' ? 'number' : f.type === 'datetime' ? 'datetime-local' : 'text'} {...register(f.name)} />
            )}
          </Field>
        );
      })}
      <button type="submit" hidden disabled={submitting} />
    </form>
  );
}

export function ResourcePage<T extends Row>({ config }: { config: ResourceConfig<T> }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { notify } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<T | null | 'new'>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const key = ['admin', config.endpoint, search, page, filters];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => get<Paginated<T>>(`/admin/${config.endpoint}`, { search, page, limit: 25, ...filters }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', config.endpoint] });

  const save = useMutation({
    mutationFn: (v: Record<string, unknown>) => (editing && editing !== 'new' ? put(`/admin/${config.endpoint}/${editing.id}`, v) : post(`/admin/${config.endpoint}`, v)),
    onSuccess: () => {
      notify(`${config.singular} saved`);
      setEditing(null);
      invalidate();
    },
    onError: (e) => {
      if (e instanceof ApiError) setServerErrors(e.fieldErrors);
      notify((e as Error).message, 'error');
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (r: T) => patch(`/admin/${config.endpoint}/${r.id}/status`, { isActive: !r.isActive }),
    onSuccess: invalidate,
    onError: (e) => notify((e as Error).message, 'error'),
  });

  const remove = async (r: T) => {
    if (!(await confirm({ title: `Delete ${config.singular.toLowerCase()}?`, text: 'This cannot be undone from the dashboard.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await del(`/admin/${config.endpoint}/${r.id}`);
      notify(`${config.singular} deleted`);
      invalidate();
    } catch (e) {
      notify((e as Error).message, 'error');
    }
  };

  const columns: Column<T>[] = [
    ...config.columns,
    ...(config.hasStatus !== false
      ? [{ key: '_status', label: 'Active', render: (r: T) => <Toggle checked={Boolean(r.isActive)} disabled={!can(config.module, 'edit')} onChange={() => toggleStatus.mutate(r)} label="Active" /> }]
      : []),
    {
      key: '_actions',
      label: '',
      className: 'text-right',
      render: (r: T) => (
        <div className="flex justify-end gap-1">
          {can(config.module, 'edit') && (
            <button onClick={() => { setServerErrors({}); setEditing(r); }} className="rounded-lg p-2 text-slate-500 hover:bg-electric-50 hover:text-electric-600" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
          )}
          {can(config.module, 'delete') && (
            <button onClick={() => remove(r)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminPage
      title={config.title}
      subtitle={config.subtitle}
      actions={can(config.module, 'create') && <Button onClick={() => { setServerErrors({}); setEditing('new'); }}><Plus className="h-4 w-4" /> Add {config.singular.toLowerCase()}</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
        {config.extraFilters?.((k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); }, filters)}
      </div>
      <DataTable rows={data?.items ?? []} columns={columns} loading={isLoading} />
      {data && <div className="mt-6"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} /></div>}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? `Add ${config.singular.toLowerCase()}` : `Edit ${config.singular.toLowerCase()}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" form="resource-form" loading={save.isPending}>Save</Button>
          </>
        }
      >
        {editing !== null && (
          <ResourceForm
            key={editing === 'new' ? 'new' : editing.id}
            fields={config.fields}
            initial={editing === 'new' ? null : editing}
            onSubmit={(v) => save.mutate(v)}
            submitting={save.isPending}
            serverErrors={serverErrors}
          />
        )}
      </Modal>
    </AdminPage>
  );
}
