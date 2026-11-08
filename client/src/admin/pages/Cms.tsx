/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, type Control, type UseFormRegister } from 'react-hook-form';
import { ICONS } from '@/components/DynamicIcon';
import { Button, PageLoader } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/context/auth';
import { get, put } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateFmt } from '@/lib/format';
import { AdminPage, Field, ImageInput, Panel, Toggle } from '../components';

type Spec = { key: string; label: string; type: 'text' | 'textarea' | 'boolean' | 'icon' | 'list' | 'image'; fields?: Spec[]; hint?: string };

const SCHEMAS: Record<string, { preview: string; fields: Spec[] }> = {
  announcement: {
    preview: '/',
    fields: [
      { key: 'enabled', label: 'Show announcement bar', type: 'boolean' },
      { key: 'items', label: 'Messages', type: 'list', fields: [{ key: 'text', label: 'Text', type: 'text' }, { key: 'link', label: 'Link (optional)', type: 'text', hint: '/offers' }] },
    ],
  },
  home_hero: {
    preview: '/',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'headline', label: 'Headline', type: 'text' },
      { key: 'highlight', label: 'Highlighted words', type: 'text' },
      { key: 'subheadline', label: 'Sub-headline', type: 'textarea' },
      { key: 'primaryCtaLabel', label: 'Primary button label', type: 'text' },
      { key: 'primaryCtaLink', label: 'Primary button link', type: 'text' },
      { key: 'secondaryCtaLabel', label: 'WhatsApp button label', type: 'text' },
      { key: 'badges', label: 'Trust badges', type: 'list', fields: [{ key: 'label', label: 'Label', type: 'text' }] },
    ],
  },
  founder_message: {
    preview: '/',
    fields: [
      { key: 'enabled', label: 'Show this section on the homepage', type: 'boolean' },
      { key: 'photoUrl', label: 'Founder / owner photo (square or portrait, under 5 MB)', type: 'image' },
      { key: 'name', label: 'Founder / owner name', type: 'text' },
      { key: 'designation', label: 'Designation', type: 'text', hint: 'e.g. Founder & Owner, Sakshi Mobile' },
      { key: 'eyebrow', label: 'Small heading', type: 'text' },
      { key: 'title', label: 'Main heading', type: 'text' },
      { key: 'message', label: 'Message for customers (Marathi or English — blank line = new paragraph)', type: 'textarea' },
      { key: 'highlights', label: 'Promise badges', type: 'list', fields: [{ key: 'label', label: 'Text', type: 'text' }] },
    ],
  },
  why_choose: {
    preview: '/',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'items', label: 'Reasons', type: 'list', fields: [{ key: 'icon', label: 'Icon', type: 'icon' }, { key: 'title', label: 'Title', type: 'text' }, { key: 'text', label: 'Text', type: 'textarea' }] },
    ],
  },
  about: {
    preview: '/about',
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'intro', label: 'Introduction', type: 'textarea' },
      { key: 'story', label: 'Our story', type: 'textarea' },
      { key: 'mission', label: 'Mission', type: 'textarea' },
      { key: 'vision', label: 'Vision', type: 'textarea' },
      { key: 'values', label: 'Values', type: 'list', fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'text', label: 'Text', type: 'text' }] },
    ],
  },
  contact: {
    preview: '/contact',
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'whatsapp', label: 'WhatsApp (fallback)', type: 'text', hint: 'Default WhatsApp is set in System Settings' },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'hours', label: 'Hours', type: 'text' },
      { key: 'note', label: 'Note shown when details are missing', type: 'text' },
    ],
  },
  footer: {
    preview: '/',
    fields: [
      { key: 'about', label: 'Footer about text', type: 'textarea' },
      { key: 'copyright', label: 'Copyright text', type: 'text' },
      { key: 'developedBy', label: 'Developed by', type: 'text' },
      { key: 'developedByUrl', label: 'Developer URL', type: 'text' },
    ],
  },
  social: {
    preview: '/',
    fields: [
      { key: 'facebook', label: 'Facebook URL', type: 'text' },
      { key: 'instagram', label: 'Instagram URL', type: 'text' },
      { key: 'youtube', label: 'YouTube URL', type: 'text' },
      { key: 'x', label: 'X (Twitter) URL', type: 'text' },
    ],
  },
  privacy: {
    preview: '/privacy-policy',
    fields: [
      { key: 'notice', label: 'Notice banner (leave empty to hide)', type: 'textarea' },
      { key: 'sections', label: 'Sections', type: 'list', fields: [{ key: 'heading', label: 'Heading', type: 'text' }, { key: 'body', label: 'Body', type: 'textarea' }] },
    ],
  },
  terms: {
    preview: '/terms-and-conditions',
    fields: [
      { key: 'notice', label: 'Notice banner (leave empty to hide)', type: 'textarea' },
      { key: 'sections', label: 'Sections', type: 'list', fields: [{ key: 'heading', label: 'Heading', type: 'text' }, { key: 'body', label: 'Body', type: 'textarea' }] },
    ],
  },
};

function ListField({ spec, path, control, register }: { spec: Spec; path: string; control: Control<any>; register: UseFormRegister<any> }) {
  const arr = useFieldArray({ control, name: path });
  const blank = Object.fromEntries((spec.fields ?? []).map((f) => [f.key, f.type === 'boolean' ? false : '']));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">{spec.label}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => arr.append(blank)}><Plus className="h-4 w-4" /> Add</Button>
      </div>
      {arr.fields.map((item, i) => (
        <div key={item.id} className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 pr-12">
          <div className="grid gap-3 sm:grid-cols-2">
            {spec.fields?.map((f) => <SpecField key={f.key} spec={f} path={`${path}.${i}.${f.key}`} control={control} register={register} />)}
          </div>
          <button type="button" onClick={() => arr.remove(i)} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}

function SpecField({ spec, path, control, register }: { spec: Spec; path: string; control: Control<any>; register: UseFormRegister<any> }) {
  if (spec.type === 'list') return <div className="sm:col-span-2"><ListField spec={spec} path={path} control={control} register={register} /></div>;
  if (spec.type === 'image')
    return (
      <div className="sm:col-span-2">
        <Controller control={control} name={path} render={({ field }) => <ImageInput label={spec.label} folder="cms" value={field.value as string} onChange={(v) => field.onChange(v ?? '')} />} />
      </div>
    );
  if (spec.type === 'boolean')
    return <Controller control={control} name={path} render={({ field }) => <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium sm:col-span-2">{spec.label}<Toggle checked={Boolean(field.value)} onChange={field.onChange} /></label>} />;
  return (
    <Field label={spec.label} hint={spec.hint} className={cn(spec.type === 'textarea' && 'sm:col-span-2')}>
      {spec.type === 'textarea' ? (
        <textarea rows={4} className="input" {...register(path)} />
      ) : spec.type === 'icon' ? (
        <select className="input" {...register(path)}>{Object.keys(ICONS).map((k) => <option key={k} value={k}>{k}</option>)}</select>
      ) : (
        <input className="input" {...register(path)} />
      )}
    </Field>
  );
}

function Editor({ pageKey }: { pageKey: string }) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const { can } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'cms', pageKey],
    queryFn: () => get<{ item: { key: string; title: string; content: Record<string, unknown>; metaTitle: string | null; metaDescription: string | null; updatedAt: string } }>(`/admin/cms/${pageKey}`),
  });
  const { register, control, handleSubmit, reset } = useForm<any>();
  useEffect(() => {
    if (data) reset({ content: data.item.content, title: data.item.title, metaTitle: data.item.metaTitle ?? '', metaDescription: data.item.metaDescription ?? '' });
  }, [data, reset]);
  const save = useMutation({
    mutationFn: (v: any) => put(`/admin/cms/${pageKey}`, v),
    onSuccess: () => {
      notify('Content published');
      qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
      qc.invalidateQueries({ queryKey: ['site'] });
      qc.invalidateQueries({ queryKey: ['public', 'home'] });
    },
    onError: (e) => notify((e as Error).message, 'error'),
  });
  if (isLoading || !data) return <PageLoader />;
  const schema = SCHEMAS[pageKey];
  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-5">
      <Panel
        title={data.item.title}
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">Updated {dateFmt(data.item.updatedAt, true)}</span>
            {schema && <a href={schema.preview} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-electric-600 hover:underline"><ExternalLink className="h-4 w-4" /> Preview</a>}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {schema ? (
            schema.fields.map((f) => <SpecField key={f.key} spec={f} path={`content.${f.key}`} control={control} register={register} />)
          ) : (
            <p className="text-sm text-slate-500">No editor defined for this block.</p>
          )}
        </div>
      </Panel>
      {['about', 'privacy', 'terms'].includes(pageKey) && (
        <Panel title="SEO">
          <div className="grid gap-4">
            <Field label="Page title"><input className="input" {...register('title')} /></Field>
            <Field label="Meta title"><input className="input" {...register('metaTitle')} /></Field>
            <Field label="Meta description"><textarea rows={2} className="input" {...register('metaDescription')} /></Field>
          </div>
        </Panel>
      )}
      {can('CMS', 'edit') && <Button type="submit" loading={save.isPending}><Save className="h-4 w-4" /> Publish changes</Button>}
    </form>
  );
}

export default function Cms() {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'cms'], queryFn: () => get<{ items: { key: string; title: string; updatedAt: string }[] }>('/admin/cms') });
  const [active, setActive] = useState('founder_message');
  if (isLoading) return <PageLoader />;
  return (
    <AdminPage title="Website CMS" subtitle="Edit website content without touching code — changes go live immediately">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col">
          {data?.items.map((b) => (
            <button key={b.key} onClick={() => setActive(b.key)} className={cn('shrink-0 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition', active === b.key ? 'bg-gradient-to-r from-electric-500 to-violet-500 text-white shadow-glow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>
              {b.title}
            </button>
          ))}
        </nav>
        <Editor key={active} pageKey={active} />
      </div>
    </AdminPage>
  );
}
