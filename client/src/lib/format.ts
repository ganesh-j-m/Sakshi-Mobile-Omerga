import type { InquiryStatus, InquiryType, OfferType, StockStatus } from '@/types';

const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const inr = (n: number | null | undefined) => (n == null ? '—' : inrFormatter.format(n));

export const effectivePrice = (p: { sellingPrice: number; offerPrice: number | null }) => p.offerPrice ?? p.sellingPrice;
export const discountPct = (p: { mrp: number; sellingPrice: number; offerPrice: number | null }) => {
  const price = effectivePrice(p);
  return p.mrp > price ? Math.round(((p.mrp - price) / p.mrp) * 100) : 0;
};

export const gb = (n: number | null | undefined) => (n == null ? null : n >= 1024 ? `${n / 1024} TB` : `${n} GB`);

export const STOCK_META: Record<StockStatus, { label: string; className: string; dot: string }> = {
  IN_STOCK: { label: 'In stock', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  LOW_STOCK: { label: 'Few left', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  OUT_OF_STOCK: { label: 'Out of stock', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-500' },
  PRE_ORDER: { label: 'Pre-order', className: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200', dot: 'bg-violet-500' },
};

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  PRODUCT: 'Product',
  BRANCH: 'Branch',
  OFFER: 'Offer',
  GENERAL: 'General',
  EXCHANGE: 'Exchange',
  EMI: 'EMI',
};

export const INQUIRY_STATUS_META: Record<InquiryStatus, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-electric-50 text-electric-700 ring-1 ring-electric-200' },
  CONTACTED: { label: 'Contacted', className: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
  IN_PROGRESS: { label: 'In progress', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  RESOLVED: { label: 'Resolved', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  CLOSED: { label: 'Closed', className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
};

export const OFFER_TYPE_LABEL: Record<OfferType, string> = {
  DISCOUNT: 'Discount',
  CASHBACK: 'Cashback',
  EXCHANGE: 'Exchange',
  EMI: 'EMI',
  BUNDLE: 'Combo',
  FESTIVAL: 'Festival',
};

export const BRANCH_TYPE_LABEL = { MAIN: 'Main store', BRANCH: 'Branch', FRANCHISE: 'Franchise', SERVICE_CENTER: 'Service centre' } as const;

export const dateFmt = (d: string | Date | null | undefined, withTime = false) =>
  d
    ? new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      }).format(new Date(d))
    : '—';

export const timeAgo = (d: string | Date) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return dateFmt(d);
};

export const fmt12 = (hhmm: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;

/* ─────────────────────────── Billing helpers ─────────────────────────── */

const rsFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Format an amount stored in paise. */
export const rs = (paise: number) => rsFormatter.format(paise / 100);

export const PAYMENT_LABEL = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', EMI: 'EMI / Finance', BANK_TRANSFER: 'Bank transfer', MIXED: 'Mixed' } as const;

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const three = (n: number) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${two(n % 100)}` : ''}` : two(n));

/** Indian-system amount in words, e.g. 27898 → "Rupees Twenty Seven Thousand Eight Hundred Ninety Eight Only". */
export function amountInWords(paise: number) {
  let n = Math.floor(paise / 100);
  const p = paise % 100;
  if (n === 0 && p === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(' ') || 'Zero'}${p ? ` and ${two(p)} Paise` : ''} Only`;
}
