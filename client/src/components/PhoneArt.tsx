import { useId } from 'react';
import { Headphones, PlugZap, Shield, Watch, BatteryCharging, ScanLine, Package } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Brand-neutral smartphone illustration used when a product has no photo yet
 * (all demo products) and in the hero. Pure SVG → crisp at any size, zero network cost.
 */
export function PhoneArt({
  color = '#2563FF',
  accent = '#7C3AED',
  className,
  label,
}: {
  color?: string;
  accent?: string;
  className?: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 400" className={cn('drop-shadow-2xl', className)} role="img" aria-label={label ?? 'Smartphone illustration'}>
      <defs>
        <linearGradient id={`body-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
        <linearGradient id={`screen-${id}`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#0B1238" />
          <stop offset="0.55" stopColor="#1E1B4B" />
          <stop offset="1" stopColor="#3B0764" />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.3" cy="0.25" r="0.9">
          <stop offset="0" stopColor={color} stopOpacity="0.9" />
          <stop offset="0.6" stopColor={accent} stopOpacity="0.25" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`shine-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="188" height="392" rx="34" fill={`url(#body-${id})`} />
      <rect x="12" y="10" width="176" height="380" rx="29" fill="#05071A" />
      <rect x="16" y="14" width="168" height="372" rx="26" fill={`url(#screen-${id})`} />
      <rect x="16" y="14" width="168" height="372" rx="26" fill={`url(#glow-${id})`} />
      {/* wallpaper waves */}
      <path d="M16 250 C 70 210, 120 300, 184 240 L184 360 Q184 386 158 386 L42 386 Q16 386 16 360 Z" fill={accent} opacity="0.35" />
      <path d="M16 290 C 80 250, 120 330, 184 280 L184 360 Q184 386 158 386 L42 386 Q16 386 16 360 Z" fill={color} opacity="0.35" />
      {/* punch-hole camera */}
      <circle cx="100" cy="30" r="5" fill="#000" stroke="#1f2937" strokeWidth="1.5" />
      {/* clock */}
      <text x="100" y="110" textAnchor="middle" fill="#fff" fontFamily="Poppins, sans-serif" fontSize="40" fontWeight="600">
        10:24
      </text>
      <text x="100" y="134" textAnchor="middle" fill="#cbd5e1" fontFamily="Poppins, sans-serif" fontSize="11">
        Sakshi Mobile
      </text>
      {/* app dock */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={36 + i * 34} y="340" width="24" height="24" rx="7" fill="#fff" opacity={0.18 + i * 0.06} />
      ))}
      <rect x="6" y="4" width="70" height="392" rx="34" fill={`url(#shine-${id})`} opacity="0.6" />
      <rect x="194" y="110" width="3" height="46" rx="1.5" fill={accent} />
      <rect x="194" y="170" width="3" height="28" rx="1.5" fill={accent} />
    </svg>
  );
}

/** Back of phone with camera module — used for the floating hero composition. */
export function PhoneBackArt({ color = '#FF7A18', accent = '#7C3AED', className }: { color?: string; accent?: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 400" className={cn('drop-shadow-2xl', className)} aria-hidden="true">
      <defs>
        <linearGradient id={`b-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={accent} />
        </linearGradient>
        <linearGradient id={`s-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="6" y="4" width="188" height="392" rx="34" fill={`url(#b-${id})`} />
      <rect x="6" y="4" width="188" height="392" rx="34" fill={`url(#s-${id})`} />
      <rect x="22" y="22" width="86" height="120" rx="24" fill="#0B1238" opacity="0.85" />
      {[
        [52, 54],
        [52, 108],
        [84, 81],
      ].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="17" fill="#111827" stroke="#374151" strokeWidth="3" />
          <circle cx={cx} cy={cy} r="8" fill="#1e3a8a" />
          <circle cx={cx - 3} cy={cy - 3} r="2.5" fill="#93c5fd" />
        </g>
      ))}
      <circle cx="90" cy="40" r="4" fill="#fde68a" />
      <text x="100" y="330" textAnchor="middle" fill="#fff" opacity="0.7" fontFamily="Poppins, sans-serif" fontSize="14" fontWeight="600" letterSpacing="3">
        SAKSHI
      </text>
    </svg>
  );
}

const ACCESSORY_ICON: Record<string, typeof Headphones> = {
  'chargers-cables': PlugZap,
  'earbuds-headphones': Headphones,
  'cases-covers': Shield,
  'screen-guards': ScanLine,
  'power-banks': BatteryCharging,
  'smart-watches': Watch,
};

export function AccessoryArt({ category, color = '#7C3AED', className }: { category?: string; color?: string; className?: string }) {
  const Icon = (category && ACCESSORY_ICON[category]) || Package;
  return (
    <div
      className={cn('flex aspect-square items-center justify-center rounded-3xl', className)}
      style={{ background: `radial-gradient(circle at 30% 25%, ${color}55, transparent 60%), linear-gradient(135deg, #EEF4FF, #F5F2FF)` }}
    >
      <Icon className="h-1/3 w-1/3 text-navy-800 drop-shadow-lg" strokeWidth={1.4} />
    </div>
  );
}
