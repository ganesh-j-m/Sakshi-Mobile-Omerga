import { useState } from 'react';
import { imageSrc, imageSrcSet } from '@/lib/api';
import { cn } from '@/lib/cn';
import { AccessoryArt, PhoneArt } from './PhoneArt';

/** Product image with lazy loading, responsive srcset and an illustrated fallback. */
export function ProductMedia({
  url,
  alt,
  type,
  categorySlug,
  color,
  className,
  sizes = '(max-width: 640px) 50vw, 25vw',
  eager,
}: {
  url?: string | null;
  alt: string;
  type: 'MOBILE' | 'ACCESSORY';
  categorySlug?: string;
  color?: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={imageSrc(url, 640)}
        srcSet={imageSrcSet(url)}
        sizes={sizes}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn('h-full w-full object-contain', className)}
      />
    );
  }
  if (type === 'ACCESSORY') return <AccessoryArt category={categorySlug} color={color} className={cn('h-full w-full', className)} />;
  return <PhoneArt color={color ?? '#2563FF'} accent="#7C3AED" label={alt} className={cn('h-full w-auto', className)} />;
}
