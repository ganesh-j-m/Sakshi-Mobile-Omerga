import { useQuery } from '@tanstack/react-query';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { InquiryForm } from '@/components/InquiryForm';
import { Reveal } from '@/components/motion';
import { PageHeader } from '@/components/PageHeader';
import { Seo } from '@/components/Seo';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { useSite } from '@/hooks/useSite';
import { get } from '@/lib/api';
import { telHref } from '@/lib/format';
import type { Branch } from '@/types';

export default function Contact() {
  const { data: site } = useSite();
  const branches = useQuery({ queryKey: ['public', 'branches'], queryFn: () => get<{ items: Branch[] }>('/public/branches') });
  const c = site?.cms.contact;
  const phone = c?.phone || site?.general.defaultPhone;
  const email = c?.email || site?.general.email;

  const cards = [
    { Icon: Phone, title: 'Call us', value: phone, href: phone ? telHref(phone) : undefined },
    { Icon: Mail, title: 'Email', value: email, href: email ? `mailto:${email}` : undefined },
    { Icon: MapPin, title: 'Address', value: c?.address },
    { Icon: Clock, title: 'Hours', value: c?.hours },
  ];

  return (
    <>
      <Seo title="Contact Us" description="Contact Sakshi Mobile for phone, accessory, exchange and EMI inquiries." />
      <PageHeader eyebrow="Contact" title={<>Let’s <span className="text-gradient">talk</span></>} text={c?.heading ?? 'We’d love to help you'} crumbs={[{ label: 'Contact' }]} />
      <section className="container py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ Icon, title, value, href }, i) => (
            <Reveal key={title} delay={i * 0.05} className="card group p-5 transition hover:-translate-y-1 hover:shadow-card-hover">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500 to-violet-500 text-white transition group-hover:rotate-6"><Icon className="h-5 w-5" /></span>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
              {value ? (
                href ? <a href={href} className="mt-1 block font-medium text-navy-900 hover:text-electric-600">{value}</a> : <p className="mt-1 font-medium text-navy-900">{value}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-400">To be updated</p>
              )}
            </Reveal>
          ))}
        </div>
        {c?.note && !phone && <p className="mt-4 text-center text-sm text-slate-500">{c.note}</p>}

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <Reveal className="card p-6 sm:p-8">
            <h2 className="mb-1 text-xl font-bold text-navy-900">Send us a message</h2>
            <p className="mb-6 text-sm text-slate-500">We usually respond during store hours.</p>
            <InquiryForm />
          </Reveal>
          <div className="space-y-4">
            <Reveal delay={0.1} className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#25D366] to-emerald-600 p-6 text-white shadow-card">
              <MessageCircle className="h-8 w-8" />
              <h3 className="mt-3 text-lg font-semibold">Quick questions? WhatsApp us</h3>
              <p className="mt-1 text-sm text-white/85">Product availability, price, exchange or EMI — ask instantly.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <WhatsAppButton variant="light" size="sm" context={{ kind: 'general' }}>General</WhatsAppButton>
                <WhatsAppButton variant="light" size="sm" context={{ kind: 'exchange' }}>Exchange</WhatsAppButton>
                <WhatsAppButton variant="light" size="sm" context={{ kind: 'emi' }}>EMI</WhatsAppButton>
              </div>
            </Reveal>
            {branches.data?.items.map((b) => (
              <Reveal key={b.id} delay={0.15} className="card p-5">
                <Link to={`/branches/${b.slug}`} className="font-semibold text-navy-900 hover:text-electric-600">{b.name}</Link>
                <p className="mt-1 text-sm text-slate-500">{[b.addressLine, b.city].filter(Boolean).join(', ')}</p>
                <div className="mt-3"><WhatsAppButton size="sm" variant="outline" number={b.whatsapp} context={{ kind: 'branch', branch: b }}>WhatsApp branch</WhatsAppButton></div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
