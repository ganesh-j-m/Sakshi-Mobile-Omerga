import { env, whatsappApiEnabled } from '../config/env.js';

/**
 * WhatsApp Business Cloud API (Meta) — sends the approved "bill" UTILITY template.
 *
 * Template body expected (create it in WhatsApp Manager, category UTILITY):
 *   Hello {{1}}, thank you for shopping at {{2}}.
 *   Your bill no. {{3}} of ₹{{4}} is ready.
 *   View / download your bill: {{5}}
 */
export type WhatsappResult = { ok: true; messageId: string } | { ok: false; error: string };

export const whatsappConfigured = () => whatsappApiEnabled;

export async function sendBillTemplate(args: {
  mobile10: string;
  customerName: string;
  businessName: string;
  billNumber: string;
  totalRupees: string;
  link: string;
}): Promise<WhatsappResult> {
  if (!whatsappApiEnabled) return { ok: false, error: 'WhatsApp API is not configured' };
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  // Template parameters may not contain new lines / tabs / 4+ spaces
  const clean = (s: string) => s.replace(/[\n\t]+/g, ' ').replace(/ {4,}/g, ' ').trim().slice(0, 200) || '-';
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `91${args.mobile10}`,
    type: 'template',
    template: {
      name: env.WHATSAPP_TEMPLATE_NAME,
      language: { code: env.WHATSAPP_TEMPLATE_LANG },
      components: [
        {
          type: 'body',
          parameters: [args.customerName, args.businessName, args.billNumber, args.totalRupees, args.link].map((t) => ({
            type: 'text',
            text: clean(t),
          })),
        },
      ],
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number; error_data?: { details?: string } };
    };
    if (!res.ok || !data.messages?.[0]?.id) {
      const e = data.error;
      const msg = e ? `${e.code ?? res.status}: ${e.error_data?.details ?? e.message ?? 'error'}` : `HTTP ${res.status}`;
      return { ok: false, error: msg.slice(0, 290) };
    }
    return { ok: true, messageId: data.messages[0].id };
  } catch (err) {
    const name = (err as Error).name;
    return {
      ok: false,
      error:
        name === 'AbortError'
          ? 'WhatsApp API timed out'
          : name === 'TypeError'
            ? 'Could not reach WhatsApp servers (check the server internet connection)'
            : String(err).slice(0, 290),
    };
  } finally {
    clearTimeout(timer);
  }
}
