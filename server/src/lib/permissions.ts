/** Modules an ADMIN can be granted. SUPER_ADMIN implicitly has everything. */
export const MODULES = [
  'PRODUCTS',
  'BRANDS',
  'CATEGORIES',
  'OFFERS',
  'BRANCHES',
  'BRANCH_PRODUCTS',
  'INQUIRIES',
  'CMS',
  'BANNERS',
  'TESTIMONIALS',
  'REPORTS',
  'BILLING',
] as const;

export type Module = (typeof MODULES)[number];
export type Action = 'view' | 'create' | 'edit' | 'delete';
export type PermissionSet = Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;

/** Default permissions given to a newly created admin (super admin can change them). */
export const DEFAULT_ADMIN_PERMISSIONS: Record<Module, { view: boolean; create: boolean; edit: boolean; delete: boolean }> = {
  PRODUCTS: { view: true, create: true, edit: true, delete: false },
  BRANDS: { view: true, create: false, edit: false, delete: false },
  CATEGORIES: { view: true, create: false, edit: false, delete: false },
  OFFERS: { view: true, create: true, edit: true, delete: false },
  BRANCHES: { view: true, create: false, edit: true, delete: false },
  BRANCH_PRODUCTS: { view: true, create: true, edit: true, delete: true },
  INQUIRIES: { view: true, create: false, edit: true, delete: false },
  CMS: { view: false, create: false, edit: false, delete: false },
  BANNERS: { view: false, create: false, edit: false, delete: false },
  TESTIMONIALS: { view: false, create: false, edit: false, delete: false },
  REPORTS: { view: true, create: false, edit: false, delete: false },
  // view = bills list, create = billing counter, edit = cancel a bill
  BILLING: { view: true, create: true, edit: false, delete: false },
};
