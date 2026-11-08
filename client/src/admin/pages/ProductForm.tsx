import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, PageLoader } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { ApiError, get, post, put } from '@/lib/api';
import { STOCK_META } from '@/lib/format';
import type { StockStatus } from '@/types';
import { AdminPage, Field, GalleryInput, Panel, Toggle } from '../components';

const STOCK = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER'] as const;
const optNum = z.union([z.coerce.number().int().min(0), z.literal(''), z.null()]).optional();

const schema = z
  .object({
    sku: z.string().trim().min(1, 'Product ID / SKU is required').max(40),
    name: z.string().trim().min(2, 'Name is required').max(200),
    slug: z.string().max(220).optional(),
    brandId: z.coerce.number().int().positive('Select a brand'),
    categoryId: z.coerce.number().int().positive('Select a category'),
    model: z.string().max(120).optional().nullable(),
    mrp: z.coerce.number().int().positive('MRP is required'),
    sellingPrice: z.coerce.number().int().positive('Selling price is required'),
    offerPrice: optNum,
    ramGb: optNum,
    storageGb: optNum,
    display: z.string().max(160).optional().nullable(),
    camera: z.string().max(200).optional().nullable(),
    battery: z.string().max(120).optional().nullable(),
    processor: z.string().max(160).optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    highlightsText: z.string().optional(),
    warranty: z.string().max(200).optional().nullable(),
    stockStatus: z.enum(STOCK),
    isFeatured: z.boolean(),
    isActive: z.boolean(),
    metaTitle: z.string().max(160).optional().nullable(),
    metaDescription: z.string().max(320).optional().nullable(),
    images: z.array(z.object({ url: z.string(), publicId: z.string().nullable().optional(), alt: z.string().nullable().optional() })),
    variants: z.array(
      z.object({
        id: z.number().optional(),
        colorName: z.string().trim().min(1, 'Colour name required'),
        colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB'),
        stockStatus: z.enum(STOCK),
        imageUrl: z.string().nullable().optional(),
      }),
    ),
    branchAvailability: z.array(z.object({ branchId: z.number(), assigned: z.boolean(), stockStatus: z.enum(STOCK), branchPrice: optNum })),
  })
  .refine((v) => v.sellingPrice <= v.mrp, { path: ['sellingPrice'], message: 'Cannot exceed MRP' })
  .refine((v) => v.offerPrice === '' || v.offerPrice == null || Number(v.offerPrice) <= v.sellingPrice, { path: ['offerPrice'], message: 'Cannot exceed selling price' });

type Values = z.input<typeof schema>;
type Options = { brands: { id: number; name: string }[]; categories: { id: number; name: string; type: string }[]; branches: { id: number; name: string; code: string }[] };

type ProductResp = {
  item: Record<string, unknown> & {
    highlights: string[];
    images: { url: string; publicId: string | null; alt: string | null }[];
    variants: { id: number; colorName: string; colorHex: string; stockStatus: StockStatus; imageUrl: string | null }[];
    branchProducts: { branchId: number; stockStatus: StockStatus; branchPrice: number | null }[];
  };
};

const n = (v: unknown) => (v === '' || v == null ? null : Number(v));

export default function ProductForm({ base }: { base: string }) {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notify } = useToast();
  const opts = useQuery({ queryKey: ['admin', 'product-options'], queryFn: () => get<Options>('/admin/products/options') });
  const existing = useQuery({ queryKey: ['admin', 'product', id], queryFn: () => get<ProductResp>(`/admin/products/${id}`), enabled: !isNew });

  const { register, control, handleSubmit, reset, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: '', name: '', slug: '', brandId: 0, categoryId: 0, mrp: 0, sellingPrice: 0, offerPrice: '', ramGb: '', storageGb: '',
      stockStatus: 'IN_STOCK', isFeatured: false, isActive: true, images: [], variants: [], branchAvailability: [], highlightsText: '',
    },
  });
  const variants = useFieldArray({ control, name: 'variants' });
  const branchRows = useFieldArray({ control, name: 'branchAvailability' });

  useEffect(() => {
    if (!opts.data) return;
    if (isNew) {
      reset((v) => ({ ...v, branchAvailability: opts.data.branches.map((b) => ({ branchId: b.id, assigned: true, stockStatus: 'IN_STOCK', branchPrice: '' })) }));
      return;
    }
    const p = existing.data?.item;
    if (!p) return;
    const bp = new Map(p.branchProducts.map((b) => [b.branchId, b]));
    const str = (k: string) => (p[k] == null ? '' : String(p[k]));
    const num = (k: string): number | '' => (p[k] == null ? '' : Number(p[k]));
    reset({
      sku: str('sku'), name: str('name'), slug: str('slug'), model: str('model'),
      brandId: Number(p.brandId), categoryId: Number(p.categoryId),
      mrp: Number(p.mrp), sellingPrice: Number(p.sellingPrice), offerPrice: num('offerPrice'),
      ramGb: num('ramGb'), storageGb: num('storageGb'),
      display: str('display'), camera: str('camera'), battery: str('battery'), processor: str('processor'),
      description: str('description'), warranty: str('warranty'), metaTitle: str('metaTitle'), metaDescription: str('metaDescription'),
      highlightsText: p.highlights.join('\n'),
      stockStatus: p.stockStatus as StockStatus, isFeatured: Boolean(p.isFeatured), isActive: Boolean(p.isActive),
      images: p.images.map((i) => ({ url: i.url, publicId: i.publicId, alt: i.alt })),
      variants: p.variants.map((v) => ({ id: v.id, colorName: v.colorName, colorHex: v.colorHex, stockStatus: v.stockStatus, imageUrl: v.imageUrl })),
      branchAvailability: opts.data.branches.map((b) => {
        const row = bp.get(b.id);
        return { branchId: b.id, assigned: Boolean(row), stockStatus: row?.stockStatus ?? 'IN_STOCK', branchPrice: row?.branchPrice ?? '' };
      }),
    });
  }, [opts.data, existing.data, isNew, reset]);

  const save = useMutation({
    mutationFn: (v: z.output<typeof schema>) => {
      const body = {
        ...v,
        offerPrice: n(v.offerPrice),
        ramGb: n(v.ramGb),
        storageGb: n(v.storageGb),
        highlights: (v.highlightsText ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
        branchAvailability: v.branchAvailability.filter((b) => b.assigned).map((b) => ({ branchId: b.branchId, stockStatus: b.stockStatus, branchPrice: n(b.branchPrice) })),
      };
      return isNew ? post<{ id: number }>('/admin/products', body) : put<{ id: number }>(`/admin/products/${id}`, body);
    },
    onSuccess: () => {
      notify(isNew ? 'Product created' : 'Product updated');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'product', id] });
      navigate(`${base}/products`);
    },
    onError: (e) => {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as keyof Values, { message: m });
      notify((e as Error).message, 'error');
    },
  });

  if (opts.isLoading || (!isNew && existing.isLoading)) return <PageLoader />;
  const err = (k: keyof Values) => formState.errors[k]?.message as string | undefined;

  return (
    <AdminPage
      title={isNew ? 'Add product' : 'Edit product'}
      actions={<Link to={`${base}/products`} className="flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft className="h-4 w-4" /> Back to products</Link>}
    >
      <form onSubmit={handleSubmit((v) => save.mutate(v as z.output<typeof schema>))} className="grid gap-6 xl:grid-cols-[1fr_360px]" noValidate>
        <div className="space-y-6">
          <Panel title="Basic information">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name *" error={err('name')} className="sm:col-span-2"><input className="input" {...register('name')} /></Field>
              <Field label="Product ID / SKU *" error={err('sku')}><input className="input uppercase" {...register('sku')} /></Field>
              <Field label="Model" error={err('model')}><input className="input" {...register('model')} /></Field>
              <Field label="Brand *" error={err('brandId')}>
                <select className="input" {...register('brandId')}>
                  <option value={0}>Select brand</option>
                  {opts.data?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Category *" error={err('categoryId')}>
                <select className="input" {...register('categoryId')}>
                  <option value={0}>Select category</option>
                  {opts.data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === 'MOBILE' ? 'Mobile' : 'Accessory'})</option>)}
                </select>
              </Field>
              <Field label="URL slug" hint="Leave empty to generate from name" className="sm:col-span-2"><input className="input" {...register('slug')} /></Field>
              <Field label="Description" className="sm:col-span-2"><textarea rows={5} className="input" {...register('description')} /></Field>
              <Field label="Highlights (one per line)" className="sm:col-span-2"><textarea rows={3} className="input" {...register('highlightsText')} /></Field>
            </div>
          </Panel>

          <Panel title="Pricing (₹)">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="MRP *" error={err('mrp')}><input type="number" min={0} className="input" {...register('mrp')} /></Field>
              <Field label="Selling price *" error={err('sellingPrice')}><input type="number" min={0} className="input" {...register('sellingPrice')} /></Field>
              <Field label="Offer price" error={err('offerPrice')}><input type="number" min={0} className="input" {...register('offerPrice')} /></Field>
            </div>
          </Panel>

          <Panel title="Specifications">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="RAM (GB)"><input type="number" min={0} className="input" {...register('ramGb')} /></Field>
              <Field label="Storage (GB)"><input type="number" min={0} className="input" {...register('storageGb')} /></Field>
              <Field label="Display"><input className="input" placeholder='6.6" FHD+ AMOLED, 120Hz' {...register('display')} /></Field>
              <Field label="Camera"><input className="input" placeholder="50MP + 8MP | 16MP front" {...register('camera')} /></Field>
              <Field label="Battery"><input className="input" placeholder="5000 mAh, 33W" {...register('battery')} /></Field>
              <Field label="Processor"><input className="input" {...register('processor')} /></Field>
              <Field label="Warranty" className="sm:col-span-2"><input className="input" {...register('warranty')} /></Field>
            </div>
          </Panel>

          <Panel title="Product images">
            <Controller control={control} name="images" render={({ field }) => <GalleryInput folder="products" value={field.value} onChange={field.onChange} />} />
          </Panel>

          <Panel title="Colour variants" actions={<Button type="button" size="sm" variant="outline" onClick={() => variants.append({ colorName: '', colorHex: '#1F2937', stockStatus: 'IN_STOCK' })}><Plus className="h-4 w-4" /> Add colour</Button>}>
            {variants.fields.length === 0 && <p className="text-sm text-slate-400">No colour variants yet.</p>}
            <div className="space-y-3">
              {variants.fields.map((f, i) => (
                <div key={f.id} className="grid items-start gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_140px_160px_auto]">
                  <div>
                    <input className="input" placeholder="Colour name" {...register(`variants.${i}.colorName`)} />
                    {formState.errors.variants?.[i]?.colorName && <p className="mt-1 text-xs text-rose-500">{formState.errors.variants[i]?.colorName?.message}</p>}
                  </div>
                  <Controller
                    control={control}
                    name={`variants.${i}.colorHex`}
                    render={({ field }) => (
                      <div className="flex gap-2">
                        <input type="color" value={field.value} onChange={field.onChange} className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200" aria-label="Colour" />
                        <input className="input" value={field.value} onChange={field.onChange} />
                      </div>
                    )}
                  />
                  <select className="input" {...register(`variants.${i}.stockStatus`)}>
                    {STOCK.map((s) => <option key={s} value={s}>{STOCK_META[s].label}</option>)}
                  </select>
                  <button type="button" onClick={() => variants.remove(i)} className="rounded-lg p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Remove colour"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="SEO (optional)">
            <div className="grid gap-4">
              <Field label="Meta title"><input className="input" {...register('metaTitle')} /></Field>
              <Field label="Meta description"><textarea rows={2} className="input" {...register('metaDescription')} /></Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <div className="space-y-4">
              <Field label="Stock status">
                <select className="input" {...register('stockStatus')}>
                  {STOCK.map((s) => <option key={s} value={s}>{STOCK_META[s].label}</option>)}
                </select>
              </Field>
              <Controller control={control} name="isActive" render={({ field }) => (
                <label className="flex items-center justify-between text-sm font-medium">Visible on website <Toggle checked={field.value} onChange={field.onChange} /></label>
              )} />
              <Controller control={control} name="isFeatured" render={({ field }) => (
                <label className="flex items-center justify-between text-sm font-medium">Featured product <Toggle checked={field.value} onChange={field.onChange} /></label>
              )} />
            </div>
          </Panel>

          <Panel title="Branch availability">
            {branchRows.fields.length === 0 && <p className="text-sm text-slate-400">No branches assigned to your account.</p>}
            <div className="space-y-3">
              {branchRows.fields.map((f, i) => {
                const branch = opts.data?.branches.find((b) => b.id === f.branchId);
                return (
                  <div key={f.id} className="rounded-xl border border-slate-200 p-3">
                    <Controller control={control} name={`branchAvailability.${i}.assigned`} render={({ field }) => (
                      <label className="flex items-center justify-between text-sm font-semibold text-navy-900">{branch?.name} <Toggle checked={field.value} onChange={field.onChange} /></label>
                    )} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select className="input py-2 text-xs" {...register(`branchAvailability.${i}.stockStatus`)}>
                        {STOCK.map((s) => <option key={s} value={s}>{STOCK_META[s].label}</option>)}
                      </select>
                      <input type="number" min={0} placeholder="Branch price" className="input py-2 text-xs" {...register(`branchAvailability.${i}.branchPrice`)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <div className="sticky bottom-4">
            <Button type="submit" size="lg" className="w-full" loading={save.isPending}><Save className="h-5 w-5" /> {isNew ? 'Create product' : 'Save changes'}</Button>
          </div>
        </div>
      </form>
    </AdminPage>
  );
}
