import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Clock, MapPin, Navigation, Phone, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { imageSrc } from '@/lib/api';
import { BRANCH_TYPE_LABEL, fmt12, telHref } from '@/lib/format';
import type { Branch, OpeningHour } from '@/types';
import { DemoBadge, buttonClass } from './ui';
import { WhatsAppButton } from './WhatsAppButton';

export function todayHours(hours: OpeningHour[]) {
  const day = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const h = hours.find((x) => x.day.toLowerCase() === day.toLowerCase());
  if (!h) return null;
  if (h.closed) return 'Closed today';
  if (!h.open || !h.close) return null;
  return `Today ${fmt12(h.open)} – ${fmt12(h.close)}`;
}

export function directionsUrl(b: Pick<Branch, 'mapsUrl' | 'latitude' | 'longitude' | 'name' | 'city'>) {
  if (b.latitude != null && b.longitude != null) return `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
  if (b.mapsUrl) return b.mapsUrl;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.city}`)}`;
}

export function BranchCard({ branch, index = 0 }: { branch: Branch; index?: number }) {
  const reduce = useReducedMotion();
  const hours = todayHours(branch.openingHours);
  const address = [branch.addressLine, branch.city, branch.district, branch.state, branch.pincode].filter(Boolean).join(', ');
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      whileHover={reduce ? undefined : { y: -6 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="relative h-44 overflow-hidden bg-navy-900">
        {branch.imageUrl ? (
          <img src={imageSrc(branch.imageUrl, 800)} alt={branch.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
        ) : (
          <div className="grid-bg flex h-full items-center justify-center bg-gradient-to-br from-navy-900 via-violet-900 to-electric-800">
            <Store className="h-14 w-14 text-white/80 transition duration-500 group-hover:scale-110" strokeWidth={1.3} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
          <span className="chip bg-white/15 text-white backdrop-blur">{BRANCH_TYPE_LABEL[branch.type]}</span>
          {branch.isDemo && <DemoBadge label="Details pending" />}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-bold text-navy-900">{branch.name}</h3>
        <p className="flex gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /> {address}
        </p>
        {branch.phone && (
          <a href={telHref(branch.phone)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-electric-600">
            <Phone className="h-4 w-4 text-violet-500" /> {branch.phone}
          </a>
        )}
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Clock className="h-4 w-4 text-violet-500" /> {hours ?? 'Timings will be updated soon'}
        </p>
        <div className="mt-auto grid grid-cols-3 gap-2 pt-3">
          <Link to={`/branches/${branch.slug}`} className={buttonClass('secondary', 'sm', 'col-span-3 sm:col-span-1')}>
            Details <ArrowRight className="h-4 w-4" />
          </Link>
          <a href={directionsUrl(branch)} target="_blank" rel="noopener noreferrer" className={buttonClass('outline', 'sm', 'col-span-3 sm:col-span-1')}>
            <Navigation className="h-4 w-4" /> Directions
          </a>
          <WhatsAppButton size="sm" className="col-span-3 sm:col-span-1" number={branch.whatsapp} context={{ kind: 'branch', branch }} />
        </div>
      </div>
    </motion.article>
  );
}
