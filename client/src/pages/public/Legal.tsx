import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Seo } from '@/components/Seo';
import { EmptyState, PageLoader } from '@/components/ui';
import { get } from '@/lib/api';
import { dateFmt } from '@/lib/format';

type Content = { notice?: string; sections?: { heading: string; body: string }[] };

export default function Legal({ pageKey }: { pageKey: 'privacy' | 'terms' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cms', pageKey],
    queryFn: () => get<{ title: string; content: Content; updatedAt: string; metaTitle: string | null; metaDescription: string | null }>(`/public/cms/${pageKey}`),
  });
  if (isLoading) return <PageLoader />;
  if (!data) return <div className="container py-20"><EmptyState title="Page not available" /></div>;
  const sections = data.content.sections ?? [];

  return (
    <>
      <Seo title={data.metaTitle || data.title} description={data.metaDescription ?? undefined} />
      <PageHeader eyebrow="Legal" title={data.title} text={`Last updated ${dateFmt(data.updatedAt)}`} crumbs={[{ label: data.title }]} />
      <section className="container max-w-3xl py-12">
        {data.content.notice && (
          <p className="mb-8 flex gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" /> {data.content.notice}
          </p>
        )}
        <div className="space-y-8">
          {sections.map((s, i) => (
            <article key={i}>
              <h2 className="text-xl font-semibold text-navy-900">{i + 1}. {s.heading}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-600">{s.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
