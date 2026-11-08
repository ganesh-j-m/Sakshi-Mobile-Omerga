import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/toast';
import { AuthProvider } from './context/auth';
import { CompareProvider } from './context/compare';
import { ApiError } from './lib/api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
  mutationCache: new MutationCache({
    onError: (err) => {
      // Session expired while working in the dashboard → back to login
      if (err instanceof ApiError && err.status === 401 && window.location.pathname.match(/^\/(super-)?admin(?!\/login)/)) {
        queryClient.setQueryData(['auth', 'me'], null);
      }
    },
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <MotionConfig reducedMotion="user">
            <ToastProvider>
              <AuthProvider>
                <CompareProvider>
                  <App />
                </CompareProvider>
              </AuthProvider>
            </ToastProvider>
          </MotionConfig>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
);
