import crypto from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { db } from '../db/index.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Indian financial year label for a date, e.g. 8 Nov 2026 → "26-27". */
export function financialYear(d = new Date()): string {
  // Use IST so bills made late at night on 31 March land in the right year
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** Atomically reserves the next number for this branch & FY (safe with many counters billing at once). */
export async function nextBillNumber(tx: Tx, branchId: number, branchCode: string, prefix: string, date = new Date()) {
  const fy = financialYear(date);
  const res = await tx.execute<{ last_number: number }>(sql`
    insert into bill_counters (branch_id, financial_year, last_number)
    values (${branchId}, ${fy}, 1)
    on conflict (branch_id, financial_year)
    do update set last_number = bill_counters.last_number + 1
    returning last_number`);
  const seq = res.rows[0].last_number;
  const cleanPrefix = prefix.replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || 'INV';
  return `${cleanPrefix}/${branchCode}/${fy}/${String(seq).padStart(5, '0')}`;
}

export const newPublicToken = () => crypto.randomBytes(18).toString('base64url');

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export type LineInput = { quantity: number; unitPricePaise: number; discountPaise: number; gstRate: number };
export type LineCalc = { taxablePaise: number; gstPaise: number; lineTotalPaise: number; grossPaise: number };

/**
 * GST maths per line.
 * - inclusive (typical retail MRP): line amount already contains GST → back-calculate taxable value
 * - exclusive: GST is added on top of the line amount
 */
export function calcLine(l: LineInput, inclusive: boolean): LineCalc {
  const gross = l.unitPricePaise * l.quantity;
  const net = Math.max(0, gross - l.discountPaise);
  if (inclusive) {
    const taxable = Math.round((net * 100) / (100 + l.gstRate));
    return { grossPaise: gross, taxablePaise: taxable, gstPaise: net - taxable, lineTotalPaise: net };
  }
  const gst = Math.round((net * l.gstRate) / 100);
  return { grossPaise: gross, taxablePaise: net, gstPaise: gst, lineTotalPaise: net + gst };
}

export function calcBill(lines: LineInput[], inclusive: boolean) {
  const calcs = lines.map((l) => calcLine(l, inclusive));
  const subtotal = calcs.reduce((a, c) => a + c.grossPaise, 0);
  const discount = lines.reduce((a, l) => a + Math.min(l.discountPaise, l.unitPricePaise * l.quantity), 0);
  const taxable = calcs.reduce((a, c) => a + c.taxablePaise, 0);
  const gst = calcs.reduce((a, c) => a + c.gstPaise, 0);
  const raw = calcs.reduce((a, c) => a + c.lineTotalPaise, 0);
  const total = Math.round(raw / 100) * 100; // round to nearest rupee
  const cgst = Math.floor(gst / 2);
  return {
    calcs,
    subtotalPaise: subtotal,
    discountPaise: discount,
    taxablePaise: taxable,
    cgstPaise: cgst,
    sgstPaise: gst - cgst,
    roundOffPaise: total - raw,
    totalPaise: total,
  };
}
