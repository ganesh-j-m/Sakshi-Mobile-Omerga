import { effectivePrice, inr } from './format';

/** Normalise to an international number for wa.me (assumes India when 10 digits). */
export function normaliseWhatsapp(n: string | null | undefined): string | null {
  if (!n) return null;
  const digits = n.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 13) return digits;
  return null;
}

export type WhatsAppContext =
  | { kind: 'product'; product: { name: string; sku: string; sellingPrice: number; offerPrice: number | null; slug: string }; color?: string; branchName?: string }
  | { kind: 'branch'; branch: { name: string; city: string } }
  | { kind: 'offer'; offer: { title: string }; branchName?: string }
  | { kind: 'exchange'; productName?: string }
  | { kind: 'emi'; productName?: string }
  | { kind: 'general' };

export function whatsappMessage(ctx: WhatsAppContext, siteName = 'Sakshi Mobile'): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  switch (ctx.kind) {
    case 'product':
      return [
        `Hello ${siteName}! 👋`,
        `I'm interested in *${ctx.product.name}*${ctx.color ? ` (${ctx.color})` : ''}.`,
        `Listed price: ${inr(effectivePrice(ctx.product))} · Code: ${ctx.product.sku}`,
        ctx.branchName ? `Preferred branch: ${ctx.branchName}` : '',
        'Please share availability and the best price.',
        `${origin}/mobiles/${ctx.product.slug}`,
      ]
        .filter(Boolean)
        .join('\n');
    case 'branch':
      return `Hello ${ctx.branch.name}! 👋\nI'd like to know more about your store in ${ctx.branch.city} — timings, available phones and offers.`;
    case 'offer':
      return `Hello ${siteName}! 👋\nI saw the offer "*${ctx.offer.title}*"${ctx.branchName ? ` for ${ctx.branchName}` : ''} on your website. Please share the details.`;
    case 'exchange':
      return `Hello ${siteName}! 👋\nI want to exchange my old phone${ctx.productName ? ` for *${ctx.productName}*` : ''}.\nOld phone model: \nCondition: \nPlease tell me the exchange value.`;
    case 'emi':
      return `Hello ${siteName}! 👋\nI'd like to know the EMI options${ctx.productName ? ` for *${ctx.productName}*` : ''}. Please share the details.`;
    default:
      return `Hello ${siteName}! 👋\nI have a question about mobiles / accessories.`;
  }
}

export function whatsappLink(number: string | null | undefined, message: string): string | null {
  const n = normaliseWhatsapp(number);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

/** WhatsApp message sent to the customer after billing (with link to the full invoice). */
export function billWhatsappMessage(
  bill: { billNumber: string; billDate: string; customerName: string; totalPaise: number; paidPaise: number; paymentMode: string; items: { description: string; quantity: number; lineTotalPaise: number; serialNumber: string | null }[] },
  link: string,
  businessName: string,
) {
  const money = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const date = new Date(bill.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const lines = bill.items.map(
    (i, idx) => `${idx + 1}. ${i.description} × ${i.quantity} — ${money(i.lineTotalPaise)}${i.serialNumber ? `\n   IMEI/Serial: ${i.serialNumber}` : ''}`,
  );
  const balance = bill.totalPaise - bill.paidPaise;
  return [
    `🧾 *${businessName} — Invoice*`,
    '',
    `Namaskar ${bill.customerName} 🙏`,
    `*Bill No:* ${bill.billNumber}`,
    `*Date:* ${date}`,
    '',
    ...lines,
    '',
    `*Total:* ${money(bill.totalPaise)}`,
    `*Paid:* ${money(bill.paidPaise)} (${bill.paymentMode})`,
    balance > 0 ? `*Balance due:* ${money(balance)}` : '',
    '',
    `📄 View / download your bill:\n${link}`,
    '',
    `Thank you for shopping with ${businessName}! 😊`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n');
}
