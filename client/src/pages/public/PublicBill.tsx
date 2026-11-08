import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Invoice } from '@/components/Invoice';
import { Logo } from '@/components/layout/Logo';
import { Seo } from '@/components/Seo';
import { Button, EmptyState, PageLoader } from '@/components/ui';
import { get } from '@/lib/api';
import type { Bill, BillingSettings } from '@/types';

/** Customer-facing invoice opened from the WhatsApp link: /bill/:token */
export default function PublicBill() {
  const { token = '' } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-bill', token],
    queryFn: () => get<{ bill: Bill; billing: BillingSettings }>(`/public/bills/${token}`),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <Seo title="Your invoice" noindex />
      <header className="bg-navy-950 print:hidden">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          {data && (
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Download / Print
            </Button>
          )}
        </div>
      </header>
      <main className="container py-8 print:p-0">
        {isLoading ? (
          <PageLoader />
        ) : error || !data ? (
          <EmptyState title="Bill not found" text="Please check the link or contact the store." />
        ) : (
          <>
            <Invoice bill={data.bill} settings={data.billing} />
            <p className="mt-4 text-center text-xs text-slate-500 print:hidden">Tip: choose “Save as PDF” in the print dialog to download your bill.</p>
          </>
        )}
      </main>
    </div>
  );
}
