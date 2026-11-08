import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useSite } from '@/hooks/useSite';

type Props = {
  title?: string;
  description?: string;
  image?: string | null;
  type?: 'website' | 'product' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

/**
 * Per-page meta tags. Values set by the Super Admin in SEO Management (keyed by route)
 * override the page defaults.
 */
export function Seo({ title, description, image, type = 'website', noindex, jsonLd }: Props) {
  const { pathname } = useLocation();
  const { data } = useSite();
  const siteName = data?.general.siteName ?? 'Sakshi Mobile';
  const override = data?.seo?.[pathname];
  const finalTitle = override?.title || title;
  const fullTitle = finalTitle ? (finalTitle.includes(siteName) ? finalTitle : `${finalTitle} | ${siteName}`) : siteName;
  const desc = override?.description || description || data?.general.tagline || '';
  const url = typeof window !== 'undefined' ? window.location.origin + pathname : pathname;
  const img = override?.ogImage || image;
  const absImg = img ? (img.startsWith('http') ? img : `${typeof window !== 'undefined' ? window.location.origin : ''}${img}`) : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {desc && <meta name="description" content={desc} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      {desc && <meta property="og:description" content={desc} />}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      {absImg && <meta property="og:image" content={absImg} />}
      <meta name="twitter:card" content={absImg ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      {desc && <meta name="twitter:description" content={desc} />}
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  );
}
