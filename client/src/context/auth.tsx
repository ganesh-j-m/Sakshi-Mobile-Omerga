import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError, get, post } from '@/lib/api';
import type { AuthUser, PermissionFlags } from '@/types';

type Ctx = {
  user: AuthUser | null;
  loading: boolean;
  can: (module: string, action?: keyof PermissionFlags) => boolean;
  isSuper: boolean;
  logout: () => Promise<void>;
  refresh: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { pathname } = useLocation();
  // Public visitors never need a session lookup — only the dashboards do
  const isAdminArea = /^\/(super-)?admin/.test(pathname);
  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return (await get<{ user: AuthUser }>('/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: isAdminArea,
  });

  const user = data ?? null;
  const value: Ctx = {
    user,
    loading: isAdminArea && isLoading,
    isSuper: user?.role === 'SUPER_ADMIN',
    can: (module, action = 'view') => !!user && (user.role === 'SUPER_ADMIN' || Boolean(user.permissions[module]?.[action])),
    logout: async () => {
      try {
        await post('/auth/logout');
      } finally {
        qc.setQueryData(['auth', 'me'], null);
        qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'admin' });
      }
    },
    refresh: () => qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
