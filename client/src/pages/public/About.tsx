import { useQuery } from '@tanstack/react-query';
import { Eye, Heart, Target } from 'lucide-react';
import { AnimatedCounter, Reveal } from '@/components/motion';
import { PageHeader } from '@/components/PageHeader';
import { PhoneArt } from '@/components/PhoneArt';
import { Seo } from '@/components/Seo';
import { LinkButton, PageLoader } from '@/components/ui';
import { get } from '@/lib/api';
import type { HomeData } from '@/types';

type AboutContent = {
  title?: string;
  intro?: string;
  story?: string;
  mission?: string;
  vision?: string;
  values?: { title: string; text: string }[];
};

export default function About() {
  const { data, isLoading } = useQuery({
    queryKey: ['cms', 'about'],
    queryFn: () => get<{ title: string; content: AboutContent; metaTitle: string | null; metaDescription: string | null }>('/public/cms/about'),
  });
  const home = useQuery({ queryKey: ['public', 'home'], queryFn: () => get<HomeData>('/public/home') });
  if (isLoading) return <PageLoader />;
  const c = data?.content ?? {};

  return (
    <>
      <Seo title={data?.metaTitle || 'About Us'} description={data?.metaDescription || c.intro} />
      <PageHeader eyebrow="About us" title={c.title ?? 'About Sakshi Mobile'} text={c.intro} crumbs={[{ label: 'About' }]} />
      <section className="container grid items-center gap-12 py-14 lg:grid-cols-2">
        <Reveal>
          <h2 className="text-2xl font-bold text-navy-900 sm:text-3xl">Our story</h2>
          <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{c.story}</p>
          {home.data && (
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { v: home.data.stats.products, l: 'Products' },
                { v: home.data.stats.brands, l: 'Brands' },
                { v: home.data.stats.branches, l: 'Branches' },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-gradient-to-br from-electric-50 to-violet-50 p-4 text-center">
                  <p className="text-3xl font-extrabold text-gradient-dark"><AnimatedCounter value={s.v} /></p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{s.l}</p>
                </div>
              ))}
            </div>
          )}
        </Reveal>
        <Reveal delay={0.1} className="relative mx-auto flex h-96 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-electric-400/30 via-violet-400/30 to-flame-400/30 blur-3xl" />
          <PhoneArt className="relative h-full w-auto animate-float" color="#7C3AED" accent="#FF7A18" />
        </Reveal>
      </section>
      <section className="bg-navy-950 py-14 text-white">
        <div className="container grid gap-6 md:grid-cols-2">
          {[
            { Icon: Target, t: 'Our mission', d: c.mission },
            { Icon: Eye, t: 'Our vision', d: c.vision },
          ].map(({ Icon, t, d }, i) => d && (
            <Reveal key={t} delay={i * 0.1} className="glass rounded-3xl p-8">
              <Icon className="h-8 w-8 text-flame-400" />
              <h3 className="mt-4 text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-slate-300">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>
      {c.values && c.values.length > 0 && (
        <section className="container py-14">
          <h2 className="mb-8 text-center text-2xl font-bold text-navy-900 sm:text-3xl">What we stand for</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            {c.values.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.08} className="card p-6 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-violet-500 text-white"><Heart className="h-6 w-6" /></span>
                <h3 className="mt-4 font-semibold text-navy-900">{v.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{v.text}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 flex justify-center gap-3">
            <LinkButton to="/mobiles">Explore mobiles</LinkButton>
            <LinkButton to="/branches" variant="outline">Visit a branch</LinkButton>
          </div>
        </section>
      )}
    </>
  );
}
