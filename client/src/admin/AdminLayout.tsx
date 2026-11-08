import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, KeyRound, LogOut, Menu, X } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/layout/Logo';
import { Seo } from '@/components/Seo';
import { PageLoader } from '@/components/ui';
import { useAuth } from '@/context/auth';
import { cn } from '@/lib/cn';
import { ConfirmProvider } from './components';
import { ADMIN_NAV } from './nav';

/** Route guard + shell for both /super-admin and /admin dashboards. */
export function AdminLayout({ base }: { base: '/super-admin' | '/admin' }) {
  const { user, loading, can, isSuper, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => setOpen(false), [location.pathname]);

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  // Each role has its own dashboard
  if (isSuper && base === '/admin') return <Navigate to={location.pathname.replace(/^\/admin/, '/super-admin')} replace />;
  if (!isSuper && base === '/super-admin') return <Navigate to={location.pathname.replace(/^\/super-admin/, '/admin')} replace />;

  const items = ADMIN_NAV.filter((n) => (n.superOnly ? isSuper : n.module ? can(n.module) : true));
  const groups = [...new Set(items.map((i) => i.group))];

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-950 text-slate-300">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo to={base} />
        <button className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mx-4 mb-3 rounded-xl bg-gradient-to-r from-electric-500/20 via-violet-500/20 to-flame-500/20 px-3 py-2 text-xs">
        <p className="font-semibold text-white">{isSuper ? 'Super Admin' : 'Admin'} Dashboard</p>
        <p className="truncate text-slate-400">{user.name}</p>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{g}</p>
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.group === g)
                .map(({ path, label, Icon, end }) => (
                  <li key={path}>
                    <NavLink
                      to={path ? `${base}/${path}` : base}
                      end={!path || end}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          isActive ? 'text-white' : 'hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl bg-gradient-to-r from-electric-500/90 to-violet-500/90 shadow-glow" transition={{ type: 'spring', damping: 30, stiffness: 350 }} />}
                          <Icon className="relative h-[18px] w-[18px]" />
                          <span className="relative">{label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3 text-xs text-slate-500">Developed by MoreTech Solution</div>
    </div>
  );

  return (
    <ConfirmProvider>
      <Seo title={`${isSuper ? 'Super Admin' : 'Admin'} Dashboard`} noindex />
      <div className="min-h-screen bg-slate-100/70 print:bg-white">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block print:!hidden">{sidebar}</aside>
        <AnimatePresence>
          {open && (
            <motion.div className="fixed inset-0 z-50 bg-navy-950/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
              <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="h-full w-64" onClick={(e) => e.stopPropagation()}>
                {sidebar}
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="lg:pl-64 print:!pl-0">
          <header className="sticky top-0 z-30 flex h-16 print:hidden items-center justify-between gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
            <button className="rounded-xl p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <p className="hidden text-sm text-slate-500 sm:block">
              Welcome back, <span className="font-semibold text-navy-900">{user.name}</span>
            </p>
            <div className="flex items-center gap-1">
              <Link to="/" target="_blank" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                <ExternalLink className="h-4 w-4" /> <span className="hidden sm:inline">View site</span>
              </Link>
              <Link to={`${base}/account`} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                <KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">Account</span>
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  navigate('/admin/login', { replace: true });
                }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8 print:p-0">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </ConfirmProvider>
  );
}

/** Blocks a dashboard route when the admin lacks the module permission. */
export function RequirePermission({ module, superOnly, children }: { module?: string; superOnly?: boolean; children: React.ReactNode }) {
  const { can, isSuper } = useAuth();
  if ((superOnly && !isSuper) || (module && !can(module))) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <h2 className="text-xl font-semibold text-navy-900">Access restricted</h2>
        <p className="mt-1 text-sm text-slate-500">You don’t have permission to view this module. Contact the Super Admin.</p>
      </div>
    );
  }
  return <>{children}</>;
}
