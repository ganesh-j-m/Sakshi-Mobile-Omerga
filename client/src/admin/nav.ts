import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  DatabaseBackup,
  FileText,
  Globe,
  Image,
  Inbox,
  LayoutDashboard,
  Layers,
  MessageSquareQuote,
  Palette,
  Receipt,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Smartphone,
  Tag,
  Tags,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { path: string; label: string; Icon: LucideIcon; module?: string; superOnly?: boolean; group: string; end?: boolean };

export const ADMIN_NAV: NavItem[] = [
  { path: '', label: 'Dashboard', Icon: LayoutDashboard, group: 'Overview' },
  { path: 'reports', label: 'Reports', Icon: BarChart3, module: 'REPORTS', group: 'Overview' },
  { path: 'inquiries', label: 'Customer Inquiries', Icon: Inbox, module: 'INQUIRIES', group: 'Overview' },

  { path: 'billing/new', label: 'Billing Counter', Icon: ScanBarcode, module: 'BILLING', group: 'Billing' },
  { path: 'billing', label: 'Bills', Icon: Receipt, module: 'BILLING', group: 'Billing', end: true },

  { path: 'products', label: 'Products', Icon: Smartphone, module: 'PRODUCTS', group: 'Catalogue' },
  { path: 'variants', label: 'Product Variants', Icon: Palette, module: 'PRODUCTS', group: 'Catalogue' },
  { path: 'brands', label: 'Brands', Icon: Tags, module: 'BRANDS', group: 'Catalogue' },
  { path: 'categories', label: 'Categories', Icon: Layers, module: 'CATEGORIES', group: 'Catalogue' },
  { path: 'offers', label: 'Offers', Icon: Tag, module: 'OFFERS', group: 'Catalogue' },

  { path: 'branches', label: 'Branches', Icon: Building2, module: 'BRANCHES', group: 'Branches' },
  { path: 'branch-products', label: 'Branch Availability', Icon: Boxes, module: 'BRANCH_PRODUCTS', group: 'Branches' },

  { path: 'website', label: 'Website CMS', Icon: FileText, module: 'CMS', group: 'Website' },
  { path: 'banners', label: 'Homepage Banners', Icon: Image, module: 'BANNERS', group: 'Website' },
  { path: 'testimonials', label: 'Testimonials', Icon: MessageSquareQuote, module: 'TESTIMONIALS', group: 'Website' },
  { path: 'seo', label: 'SEO Management', Icon: Globe, superOnly: true, group: 'Website' },

  { path: 'admins', label: 'Admin Management', Icon: ShieldCheck, superOnly: true, group: 'System' },
  { path: 'activity-logs', label: 'Activity Logs', Icon: Activity, superOnly: true, group: 'System' },
  { path: 'settings', label: 'System Settings', Icon: Settings, superOnly: true, group: 'System' },
  { path: 'backups', label: 'Database Backups', Icon: DatabaseBackup, superOnly: true, group: 'System' },
];
