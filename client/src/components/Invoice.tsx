import { amountInWords, dateFmt, PAYMENT_LABEL, rs } from '@/lib/format';
import type { Bill, BillingSettings } from '@/types';

/** Printable A4 invoice — used in the dashboard and on the customer's WhatsApp link. */
export function Invoice({ bill, settings }: { bill: Bill; settings: BillingSettings }) {
  const b = bill.branch;
  const branchAddress = [b.addressLine, b.city, b.district, b.state, b.pincode].filter(Boolean).join(', ');
  const isTax = Boolean(settings.gstin);
  const balance = bill.totalPaise - bill.paidPaise;
  const gstTotal = bill.cgstPaise + bill.sgstPaise;

  return (
    <article className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white text-[13px] leading-snug text-slate-800 shadow-card ring-1 ring-slate-200 print:max-w-none print:shadow-none print:ring-0">
      {bill.status === 'CANCELLED' && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="-rotate-[25deg] rounded-xl border-8 border-rose-500/60 px-8 py-2 text-7xl font-black tracking-widest text-rose-500/60">CANCELLED</span>
        </div>
      )}
      <div className="h-2 bg-gradient-to-r from-electric-600 via-violet-600 to-flame-500" />
      <div className="p-6 sm:p-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row">
          <div>
            <h1 className="text-2xl font-extrabold text-navy-900">{settings.businessName}</h1>
            <p className="mt-1 max-w-sm text-xs text-slate-600">{settings.address || branchAddress}</p>
            <p className="text-xs text-slate-600">
              {[settings.phone || b.phone, settings.email || b.email].filter(Boolean).join(' · ')}
            </p>
            {isTax && <p className="mt-1 text-xs font-semibold">GSTIN: {settings.gstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-lg font-bold tracking-wide text-violet-700">{isTax ? 'TAX INVOICE' : 'INVOICE'}</p>
            <p className="mt-1"><span className="text-slate-500">Bill No:</span> <b>{bill.billNumber}</b></p>
            <p><span className="text-slate-500">Date:</span> {dateFmt(bill.billDate, true)}</p>
            <p><span className="text-slate-500">Branch:</span> {b.name}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bill to</p>
            <p className="mt-1 font-semibold text-navy-900">{bill.customerName}</p>
            <p>Mobile: {bill.customerMobile}</p>
            {bill.customerAddress && <p className="text-slate-600">{bill.customerAddress}</p>}
            {bill.customerGstin && <p>GSTIN: {bill.customerGstin}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Payment</p>
            <p className="mt-1">{PAYMENT_LABEL[bill.paymentMode]}{bill.paymentReference ? ` · Ref: ${bill.paymentReference}` : ''}</p>
            <p className={balance > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
              {bill.status === 'CANCELLED' ? 'Cancelled' : balance > 0 ? `Balance due ${rs(balance)}` : 'Paid in full'}
            </p>
          </div>
        </section>

        <table className="mt-4 w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Rate</th>
              <th className="px-2 py-2 text-right">Disc.</th>
              {isTax && <th className="px-2 py-2 text-right">GST</th>}
              <th className="px-2 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((i, idx) => (
              <tr key={i.id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
                <td className="px-2 py-2">
                  <p className="font-medium text-navy-900">{i.description}</p>
                  <p className="text-[11px] text-slate-500">
                    {[i.serialNumber && `IMEI/SN: ${i.serialNumber}`, i.hsnCode && `HSN: ${i.hsnCode}`, i.sku && `SKU: ${i.sku}`].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-2 py-2 text-right">{i.quantity}</td>
                <td className="px-2 py-2 text-right">{rs(i.unitPricePaise)}</td>
                <td className="px-2 py-2 text-right">{i.discountPaise ? rs(i.discountPaise) : '—'}</td>
                {isTax && <td className="px-2 py-2 text-right">{i.gstRate}%</td>}
                <td className="px-2 py-2 text-right font-semibold">{rs(i.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex flex-col-reverse justify-between gap-6 sm:flex-row">
          <div className="max-w-sm text-xs text-slate-600">
            <p className="font-semibold text-navy-900">{amountInWords(bill.totalPaise)}</p>
            {bill.notes && <p className="mt-3 whitespace-pre-line"><b>Note:</b> {bill.notes}</p>}
            {settings.terms && (
              <div className="mt-3">
                <p className="font-semibold text-slate-700">Terms & conditions</p>
                <p className="whitespace-pre-line">{settings.terms}</p>
              </div>
            )}
          </div>
          <dl className="w-full space-y-1 sm:w-72">
            <Row label="Subtotal" value={rs(bill.subtotalPaise)} />
            {bill.discountPaise > 0 && <Row label="Discount" value={`− ${rs(bill.discountPaise)}`} />}
            {isTax && (
              <>
                <Row label="Taxable value" value={rs(bill.taxablePaise)} />
                <Row label="CGST" value={rs(bill.cgstPaise)} />
                <Row label="SGST" value={rs(bill.sgstPaise)} />
              </>
            )}
            {!isTax && gstTotal > 0 && <Row label="Tax" value={rs(gstTotal)} />}
            {bill.roundOffPaise !== 0 && <Row label="Round off" value={rs(bill.roundOffPaise)} />}
            <div className="flex justify-between rounded-lg bg-navy-900 px-3 py-2 text-base font-bold text-white print:bg-navy-900">
              <dt>Total</dt>
              <dd>{rs(bill.totalPaise)}</dd>
            </div>
            <Row label="Received" value={rs(bill.paidPaise)} />
            {balance > 0 && <Row label="Balance" value={rs(balance)} strong />}
            {isTax && bill.pricesIncludeGst && <p className="pt-1 text-right text-[10px] text-slate-400">Prices inclusive of GST</p>}
          </dl>
        </section>

        {bill.status === 'CANCELLED' && bill.cancelReason && (
          <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">Cancelled on {dateFmt(bill.cancelledAt, true)} — {bill.cancelReason}</p>
        )}

        <footer className="mt-8 flex items-end justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>{settings.footerNote}<br /><span className="text-[10px]">This is a computer-generated invoice.</span></p>
          <p className="text-right">For {settings.businessName}<br /><br /><span className="text-slate-400">Authorised signatory</span></p>
        </footer>
      </div>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between px-3 ${strong ? 'font-semibold text-amber-700' : ''}`}>
      <dt className="text-slate-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
