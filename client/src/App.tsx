import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout, RequirePermission } from './admin/AdminLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { PageLoader } from './components/ui';

// Public pages (code-split)
const Home = lazy(() => import('./pages/public/Home'));
const Catalog = lazy(() => import('./pages/public/Catalog'));
const ProductDetails = lazy(() => import('./pages/public/ProductDetails'));
const Brands = lazy(() => import('./pages/public/Brands'));
const BrandDetails = lazy(() => import('./pages/public/BrandDetails'));
const Offers = lazy(() => import('./pages/public/Offers'));
const Compare = lazy(() => import('./pages/public/Compare'));
const Branches = lazy(() => import('./pages/public/Branches'));
const BranchDetails = lazy(() => import('./pages/public/BranchDetails'));
const About = lazy(() => import('./pages/public/About'));
const Contact = lazy(() => import('./pages/public/Contact'));
const Legal = lazy(() => import('./pages/public/Legal'));
const NotFound = lazy(() => import('./pages/public/NotFound'));

// Admin pages (code-split, never downloaded by normal visitors)
const Login = lazy(() => import('./admin/pages/Login'));
const Dashboard = lazy(() => import('./admin/pages/Dashboard'));
const Products = lazy(() => import('./admin/pages/Products'));
const ProductForm = lazy(() => import('./admin/pages/ProductForm'));
const OffersAdmin = lazy(() => import('./admin/pages/Offers'));
const BranchProducts = lazy(() => import('./admin/pages/BranchProducts'));
const Inquiries = lazy(() => import('./admin/pages/Inquiries'));
const Cms = lazy(() => import('./admin/pages/Cms'));
const Reports = lazy(() => import('./admin/pages/Reports'));
const Admins = lazy(() => import('./admin/pages/Admins'));
const PublicBill = lazy(() => import('./pages/public/PublicBill'));
const BillingCounter = lazy(() => import('./admin/pages/Billing').then((m) => ({ default: m.BillingCounter })));
const BillsList = lazy(() => import('./admin/pages/Billing').then((m) => ({ default: m.BillsList })));
const BillView = lazy(() => import('./admin/pages/Billing').then((m) => ({ default: m.BillView })));
const BranchesList = lazy(() => import('./admin/pages/Branches').then((m) => ({ default: m.BranchesList })));
const BranchForm = lazy(() => import('./admin/pages/Branches').then((m) => ({ default: m.BranchForm })));
const BrandsPage = lazy(() => import('./admin/pages/Resources').then((m) => ({ default: m.BrandsPage })));
const CategoriesPage = lazy(() => import('./admin/pages/Resources').then((m) => ({ default: m.CategoriesPage })));
const TestimonialsPage = lazy(() => import('./admin/pages/Resources').then((m) => ({ default: m.TestimonialsPage })));
const BannersPage = lazy(() => import('./admin/pages/Resources').then((m) => ({ default: m.BannersPage })));
const VariantsPage = lazy(() => import('./admin/pages/Resources').then((m) => ({ default: m.VariantsPage })));
const SettingsPage = lazy(() => import('./admin/pages/System').then((m) => ({ default: m.SettingsPage })));
const SeoPage = lazy(() => import('./admin/pages/System').then((m) => ({ default: m.SeoPage })));
const ActivityLogsPage = lazy(() => import('./admin/pages/System').then((m) => ({ default: m.ActivityLogsPage })));
const BackupsPage = lazy(() => import('./admin/pages/System').then((m) => ({ default: m.BackupsPage })));
const AccountPage = lazy(() => import('./admin/pages/System').then((m) => ({ default: m.AccountPage })));

function dashboardRoutes(base: '/super-admin' | '/admin') {
  const guard = (el: ReactNode, module?: string, superOnly?: boolean) => (
    <RequirePermission module={module} superOnly={superOnly}>
      {el}
    </RequirePermission>
  );
  return (
    <Route path={base} element={<AdminLayout base={base} />}>
      <Route index element={<Dashboard base={base} />} />
      <Route path="billing" element={guard(<BillsList base={base} />, 'BILLING')} />
      <Route path="billing/new" element={guard(<BillingCounter base={base} />, 'BILLING')} />
      <Route path="billing/:id" element={guard(<BillView key={base} base={base} />, 'BILLING')} />
      <Route path="products" element={guard(<Products base={base} />, 'PRODUCTS')} />
      <Route path="products/:id" element={guard(<ProductForm base={base} />, 'PRODUCTS')} />
      <Route path="variants" element={guard(<VariantsPage />, 'PRODUCTS')} />
      <Route path="brands" element={guard(<BrandsPage />, 'BRANDS')} />
      <Route path="categories" element={guard(<CategoriesPage />, 'CATEGORIES')} />
      <Route path="offers" element={guard(<OffersAdmin />, 'OFFERS')} />
      <Route path="branches" element={guard(<BranchesList base={base} />, 'BRANCHES')} />
      <Route path="branches/:id" element={guard(<BranchForm base={base} />, 'BRANCHES')} />
      <Route path="branch-products" element={guard(<BranchProducts />, 'BRANCH_PRODUCTS')} />
      <Route path="inquiries" element={guard(<Inquiries />, 'INQUIRIES')} />
      <Route path="website" element={guard(<Cms />, 'CMS')} />
      <Route path="banners" element={guard(<BannersPage />, 'BANNERS')} />
      <Route path="testimonials" element={guard(<TestimonialsPage />, 'TESTIMONIALS')} />
      <Route path="reports" element={guard(<Reports />, 'REPORTS')} />
      <Route path="seo" element={guard(<SeoPage />, undefined, true)} />
      <Route path="admins" element={guard(<Admins />, undefined, true)} />
      <Route path="activity-logs" element={guard(<ActivityLogsPage />, undefined, true)} />
      <Route path="settings" element={guard(<SettingsPage />, undefined, true)} />
      <Route path="backups" element={guard(<BackupsPage />, undefined, true)} />
      <Route path="account" element={<AccountPage />} />
      <Route path="*" element={<Navigate to={base} replace />} />
    </Route>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="mobiles" element={<Catalog key="m" type="MOBILE" />} />
          <Route path="mobiles/:slug" element={<ProductDetails />} />
          <Route path="accessories" element={<Catalog key="a" type="ACCESSORY" />} />
          <Route path="accessories/:slug" element={<ProductDetails />} />
          <Route path="brands" element={<Brands />} />
          <Route path="brands/:slug" element={<BrandDetails />} />
          <Route path="offers" element={<Offers />} />
          <Route path="compare" element={<Compare />} />
          <Route path="branches" element={<Branches />} />
          <Route path="branches/:slug" element={<BranchDetails />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="privacy-policy" element={<Legal key="p" pageKey="privacy" />} />
          <Route path="terms-and-conditions" element={<Legal key="t" pageKey="terms" />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/admin/login" element={<Login />} />
        <Route path="/bill/:token" element={<PublicBill />} />
        {dashboardRoutes('/super-admin')}
        {dashboardRoutes('/admin')}
      </Routes>
    </Suspense>
  );
}
