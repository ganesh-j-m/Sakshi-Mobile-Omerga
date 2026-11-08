import { motion } from 'framer-motion';
import { ImagePlus, Loader2, Search, Trash2, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { api, imageSrc } from '@/lib/api';
import { cn } from '@/lib/cn';

/* ───────────────────────────── Page shell ───────────────────────────── */

export function AdminPage({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </motion.div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-slate-200/80 bg-white shadow-card', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="font-semibold text-navy-900">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, Icon, tone = 'blue', hint }: { label: string; value: ReactNode; Icon: LucideIcon; tone?: 'blue' | 'violet' | 'orange' | 'green' | 'rose' | 'navy'; hint?: string }) {
  const tones = {
    blue: 'from-electric-500 to-cyan-500',
    violet: 'from-violet-500 to-fuchsia-500',
    orange: 'from-flame-500 to-amber-500',
    green: 'from-emerald-500 to-teal-500',
    rose: 'from-rose-500 to-pink-500',
    navy: 'from-navy-700 to-electric-700',
  };
  return (
    <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className={cn('absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-15 blur-xl', tones[tone])} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-navy-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg', tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-9" aria-label={placeholder} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50', checked ? 'bg-gradient-to-r from-electric-500 to-violet-500' : 'bg-slate-300')}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

export function Field({ label, error, children, hint, className }: { label: string; error?: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

/* ─────────────────────────── Table ─────────────────────────── */

export type Column<T> = { key: string; label: string; render: (row: T) => ReactNode; className?: string };

export function DataTable<T extends { id: number | string }>({ rows, columns, loading, empty = 'No records found', onRowClick }: { rows: T[]; columns: Column<T>[]; loading?: boolean; empty?: string; onRowClick?: (row: T) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} className={cn('px-4 py-3 font-semibold', c.className)}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>{columns.map((c) => <td key={c.key} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>)}</tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400">{empty}</td></tr>
          )}
          {!loading &&
            rows.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('transition hover:bg-electric-50/40', onRowClick && 'cursor-pointer')}>
                {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────── Image upload ─────────────────────────── */

export type UploadedImage = { url: string; publicId?: string | null; alt?: string | null };

async function uploadFiles(files: FileList | File[], folder: string, maxMb = 5): Promise<UploadedImage[]> {
  const arr = Array.from(files);
  for (const f of arr) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(f.type)) throw new Error(`${f.name}: only JPG, PNG, WEBP or AVIF allowed`);
    if (f.size > maxMb * 1024 * 1024) throw new Error(`${f.name}: must be under ${maxMb} MB`);
  }
  const fd = new FormData();
  arr.forEach((f) => fd.append('files', f));
  const res = await api<{ items: UploadedImage[] }>(`/admin/uploads?folder=${folder}`, { method: 'POST', body: fd });
  return res.items;
}

export function ImageInput({ value, onChange, folder, label = 'Image' }: { value: string | null | undefined; onChange: (url: string | null) => void; folder: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
          {value ? <img src={imageSrc(value, 200)} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-slate-400" />}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <input value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} placeholder="https://… or upload" className="input py-2" />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" loading={busy} onClick={() => ref.current?.click()}>Upload</Button>
            {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>Remove</Button>}
          </div>
        </div>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          setBusy(true);
          try {
            const [img] = await uploadFiles(e.target.files, folder);
            onChange(img.url);
          } catch (err) {
            notify((err as Error).message, 'error');
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

export function GalleryInput({ value, onChange, folder }: { value: UploadedImage[]; onChange: (v: UploadedImage[]) => void; folder: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {value.map((img, i) => (
          <div key={`${img.url}-${i}`} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={imageSrc(img.url, 240)} alt="" className="h-full w-full object-contain" />
            {i === 0 && <span className="chip absolute left-1.5 top-1.5 bg-navy-900 text-[10px] text-white">Cover</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-navy-950/70 p-1 opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => move(i, i - 1)} className="px-1.5 text-xs text-white" aria-label="Move left">◀</button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-rose-300" aria-label="Remove image"><Trash2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(i, i + 1)} className="px-1.5 text-xs text-white" aria-label="Move right">▶</button>
            </div>
          </div>
        ))}
        {value.length < 12 && (
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-electric-400 hover:text-electric-500">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            <span className="text-xs">Add images</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">JPG/PNG/WEBP/AVIF, max 5 MB each, up to 12 images. First image is the cover.</p>
      <input
        ref={ref}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={async (e) => {
          if (!e.target.files?.length) return;
          setBusy(true);
          try {
            const uploaded = await uploadFiles(Array.from(e.target.files).slice(0, 12 - value.length), folder);
            onChange([...value, ...uploaded]);
          } catch (err) {
            notify((err as Error).message, 'error');
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}

/* ─────────────────────────── Confirm dialog ─────────────────────────── */

type ConfirmOpts = { title: string; text?: string; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state?.confirmLabel ?? 'Confirm'}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{state?.text}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
