import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError, get, post } from '@/lib/api';
import { cn } from '@/lib/cn';
import { INQUIRY_TYPE_LABEL } from '@/lib/format';
import type { Branch, InquiryType } from '@/types';
import { Button } from './ui';

const schema = z.object({
  customerName: z.string().trim().min(2, 'Please enter your name').max(120),
  mobile: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number')),
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional(),
  type: z.enum(['PRODUCT', 'BRANCH', 'OFFER', 'GENERAL', 'EXCHANGE', 'EMI']),
  branchId: z.string().optional(),
  message: z.string().trim().max(2000).optional(),
  website: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please allow us to contact you' }) }),
});
type Values = z.input<typeof schema>;

export function InquiryForm({
  productId,
  productName,
  offerId,
  branchId,
  defaultType = 'GENERAL',
  compact,
  dark,
}: {
  productId?: number;
  productName?: string;
  offerId?: number;
  branchId?: number;
  defaultType?: InquiryType;
  compact?: boolean;
  dark?: boolean;
}) {
  const [done, setDone] = useState(false);
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: () => get<{ items: Branch[] }>('/public/branches') });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: defaultType,
      branchId: branchId ? String(branchId) : '',
      message: productName ? `I'm interested in ${productName}.` : '',
      email: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (v: z.output<typeof schema>) =>
      post('/public/inquiries', {
        ...v,
        productId: productId ?? null,
        offerId: offerId ?? null,
        branchId: v.branchId ? Number(v.branchId) : null,
      }),
    onSuccess: () => {
      setDone(true);
      reset();
    },
    onError: (e) => {
      if (e instanceof ApiError) {
        for (const [k, msg] of Object.entries(e.fieldErrors)) setError(k as keyof Values, { message: msg });
      }
    },
  });

  const label = cn('label', dark && 'text-slate-300');
  const input = cn('input', dark && 'border-white/10 bg-white/5 text-white placeholder:text-slate-400 focus:bg-white/10');
  const err = (m?: string) => m && <p className="mt-1 text-xs text-rose-500">{m}</p>;

  if (done) {
    return (
      <div className={cn('flex flex-col items-center rounded-3xl p-8 text-center', dark ? 'bg-white/5 text-white' : 'bg-emerald-50')}>
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h3 className="mt-3 text-lg font-semibold">Thank you! Inquiry received.</h3>
        <p className={cn('mt-1 text-sm', dark ? 'text-slate-300' : 'text-slate-600')}>Our team will contact you on your mobile number soon.</p>
        <Button variant={dark ? 'light' : 'outline'} size="sm" className="mt-5" onClick={() => setDone(false)}>
          Send another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v as z.output<typeof schema>))} className="space-y-4" noValidate>
      {/* Honeypot (hidden from humans) */}
      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" {...register('website')} />
      <div className={cn('grid gap-4', !compact && 'sm:grid-cols-2')}>
        <div>
          <label className={label} htmlFor="inq-name">Your name *</label>
          <input id="inq-name" className={input} autoComplete="name" {...register('customerName')} />
          {err(errors.customerName?.message)}
        </div>
        <div>
          <label className={label} htmlFor="inq-mobile">Mobile number *</label>
          <input id="inq-mobile" className={input} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" {...register('mobile')} />
          {err(errors.mobile?.message)}
        </div>
        <div>
          <label className={label} htmlFor="inq-email">Email (optional)</label>
          <input id="inq-email" className={input} type="email" autoComplete="email" {...register('email')} />
          {err(errors.email?.message)}
        </div>
        <div>
          <label className={label} htmlFor="inq-type">Inquiry type</label>
          <select id="inq-type" className={input} {...register('type')}>
            {(Object.keys(INQUIRY_TYPE_LABEL) as InquiryType[]).map((t) => (
              <option key={t} value={t} className="text-navy-900">
                {INQUIRY_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className={cn(!compact && 'sm:col-span-2')}>
          <label className={label} htmlFor="inq-branch">Preferred branch</label>
          <select id="inq-branch" className={input} {...register('branchId')}>
            <option value="" className="text-navy-900">Any branch</option>
            {branches.data?.items.map((b) => (
              <option key={b.id} value={b.id} className="text-navy-900">
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className={cn(!compact && 'sm:col-span-2')}>
          <label className={label} htmlFor="inq-msg">Message</label>
          <textarea id="inq-msg" rows={compact ? 3 : 4} className={input} {...register('message')} />
          {err(errors.message?.message)}
        </div>
      </div>
      <label className={cn('flex items-start gap-2 text-xs', dark ? 'text-slate-300' : 'text-slate-600')}>
        <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-violet-600" {...register('consent')} />
        I agree to be contacted by Sakshi Mobile about this inquiry.
      </label>
      {err(errors.consent?.message)}
      {mutation.isError && !(mutation.error instanceof ApiError && Object.keys(mutation.error.fieldErrors).length) && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{(mutation.error as Error).message}</p>
      )}
      <Button type="submit" loading={mutation.isPending} className="w-full sm:w-auto">
        <Send className="h-4 w-4" /> Send inquiry
      </Button>
    </form>
  );
}
