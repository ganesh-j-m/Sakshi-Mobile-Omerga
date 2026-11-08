import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import type { SiteData } from '@/types';

export function useSite() {
  return useQuery({
    queryKey: ['site'],
    queryFn: () => get<SiteData>('/public/site'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Default WhatsApp number configured by the Super Admin (never hard-coded). */
export function useDefaultWhatsapp() {
  const { data } = useSite();
  return data?.general.defaultWhatsapp || data?.cms.contact?.whatsapp || '';
}
