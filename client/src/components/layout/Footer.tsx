import { Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSite } from '@/hooks/useSite';
import { telHref } from '@/lib/format';
import { Logo } from './Logo';

export function Footer() {
  const { data } = useSite();
  const footer = data?.cms.footer;
  const contact = data?.cms.contact;
  const social = data?.cms.social ?? {};
  const phone = contact?.phone || data?.general.defaultPhone;
  const email = contact?.email || data?.general.email;
  const socials = [
    { href: social.facebook, Icon: Facebook, label: 'Facebook' },
    { href: social.instagram, Icon: Instagram, label: 'Instagram' },
    { href: social.youtube, Icon: Youtube, label: 'YouTube' },
    { href: social.x, Icon: Twitter, label: 'X' },
  ].filter((s) => s.href);

  const cols = [
    {
      title: 'Shop',
      links: [
        { to: '/mobiles', label: 'All Mobiles' },
        { to: '/accessories', label: 'Accessories' },
        { to: '/brands', label: 'Brands' },
        { to: '/offers', label: 'Latest Offers' },
        { to: '/compare', label: 'Compare Mobiles' },
      ],
    },
    {
      title: 'Company',
      links: [
        { to: '/about', label: 'About Us' },
        { to: '/branches', label: 'Our Branches' },
        { to: '/contact', label: 'Contact Us' },
        { to: '/privacy-policy', label: 'Privacy Policy' },
        { to: '/terms-and-conditions', label: 'Terms & Conditions' },
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-navy-950 text-slate-300">
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-40" />
      <div className="container relative grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-slate-400">{footer?.about}</p>
          {socials.length > 0 && (
            <div className="flex gap-2">
              {socials.map(({ href, Icon, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 transition hover:-translate-y-0.5 hover:bg-gradient-to-br hover:from-electric-500 hover:to-violet-500 hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">{c.title}</h3>
            <ul className="space-y-2.5 text-sm">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="transition hover:pl-1 hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Get in touch</h3>
          <ul className="space-y-3 text-sm">
            {contact?.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-flame-400" /> {contact.address}
              </li>
            )}
            {phone && (
              <li>
                <a href={telHref(phone)} className="flex gap-2 hover:text-white">
                  <Phone className="h-4 w-4 text-flame-400" /> {phone}
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`} className="flex gap-2 hover:text-white">
                  <Mail className="h-4 w-4 text-flame-400" /> {email}
                </a>
              </li>
            )}
            {!phone && !email && <li className="text-slate-500">{contact?.note}</li>}
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {footer?.copyright ?? 'Sakshi Mobile. All rights reserved.'}
          </p>
          <p>
            Designed & developed by{' '}
            {footer?.developedByUrl ? (
              <a href={footer.developedByUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 hover:text-white">
                {footer.developedBy ?? 'MoreTech Solution'}
              </a>
            ) : (
              <span className="font-semibold text-slate-300">{footer?.developedBy ?? 'MoreTech Solution'}</span>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
