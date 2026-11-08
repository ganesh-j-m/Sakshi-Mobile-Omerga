import {
  BadgeCheck,
  BatteryCharging,
  CreditCard,
  Headphones,
  Heart,
  Layers,
  MapPin,
  Phone,
  PlugZap,
  RefreshCw,
  ScanLine,
  Shield,
  ShieldCheck,
  Signal,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Watch,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/** Whitelisted icon names that admins can use in CMS content & categories. */
export const ICONS: Record<string, LucideIcon> = {
  BadgeCheck,
  BatteryCharging,
  CreditCard,
  Headphones,
  Heart,
  Layers,
  MapPin,
  Phone,
  PlugZap,
  RefreshCw,
  ScanLine,
  Shield,
  ShieldCheck,
  Signal,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Watch,
  Wrench,
};

export function DynamicIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Sparkles;
  return <Icon className={className} />;
}
