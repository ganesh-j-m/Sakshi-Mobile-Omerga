import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Logo } from '@/components/layout/Logo';
import { PhoneArt } from '@/components/PhoneArt';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/auth';
import { post } from '@/lib/api';
import type { AuthUser } from '@/types';

const schema = z.object({
  loginId: z.string().trim().min(3, 'Enter your Login ID'),
  password: z.string().min(1, 'Enter your password'),
});
type Values = z.infer<typeof schema>;

export default function Login() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const login = useMutation({
    mutationFn: (v: Values) => post<{ user: AuthUser; redirectTo: string }>('/auth/login', v),
    onSuccess: ({ user: u, redirectTo }) => {
      qc.setQueryData(['auth', 'me'], u);
      const from = (location.state as { from?: string } | null)?.from;
      // Only honour “from” if it belongs to this user's dashboard
      navigate(from && from.startsWith(redirectTo) ? from : redirectTo, { replace: true });
    },
  });

  if (user) return <Navigate to={user.role === 'SUPER_ADMIN' ? '/super-admin' : '/admin'} replace />;

  return (
    <div className="relative grid min-h-screen overflow-hidden bg-navy-950 lg:grid-cols-2">
      <Seo title="Admin Login" noindex />
      <div className="animated-gradient pointer-events-none absolute inset-0 bg-hero-gradient" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative hidden flex-col justify-between p-12 text-white lg:flex">
        <Logo />
        <div className="relative flex items-center gap-10">
          <PhoneArt className="h-80 w-auto -rotate-6 animate-float" />
          <div>
            <h2 className="text-4xl font-extrabold leading-tight">Manage your <span className="text-gradient">stores</span>, catalogue & inquiries.</h2>
            <p className="mt-3 text-slate-300">Secure management portal for Sakshi Mobile.</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">Developed by MoreTech Solution</p>
      </div>

      <div className="relative flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <div className="mb-8 lg:hidden"><Logo dark={false} /></div>
          <h1 className="text-2xl font-bold text-navy-900">Admin login</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with the Login ID provided by your Super Admin.</p>
          <form onSubmit={handleSubmit((v) => login.mutate(v))} className="mt-8 space-y-5" noValidate>
            <div>
              <label className="label" htmlFor="loginId">Login ID</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="loginId" autoComplete="username" autoFocus className="input pl-9" {...register('loginId')} />
              </div>
              {formState.errors.loginId && <p className="mt-1 text-xs text-rose-500">{formState.errors.loginId.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className="input px-9" {...register('password')} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formState.errors.password && <p className="mt-1 text-xs text-rose-500">{formState.errors.password.message}</p>}
            </div>
            {login.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{(login.error as Error).message}</p>}
            <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
              <LogIn className="h-5 w-5" /> Sign in
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
