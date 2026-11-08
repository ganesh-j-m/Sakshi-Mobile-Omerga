import { MessageCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDefaultWhatsapp, useSite } from '@/hooks/useSite';
import { cn } from '@/lib/cn';
import { whatsappLink, whatsappMessage, type WhatsAppContext } from '@/lib/whatsapp';
import { buttonClass } from './ui';

/**
 * Opens WhatsApp with a pre-filled message. Uses the branch-specific number when given,
 * otherwise the default number configured by the Super Admin. If no number has been
 * configured yet, the button is disabled (we never invent phone numbers).
 */
export function WhatsAppButton({
  context,
  number,
  children,
  size = 'md',
  variant = 'whatsapp',
  className,
  iconOnly,
}: {
  context: WhatsAppContext;
  number?: string | null;
  children?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'whatsapp' | 'light' | 'outline';
  className?: string;
  iconOnly?: boolean;
}) {
  const fallback = useDefaultWhatsapp();
  const { data } = useSite();
  const href = whatsappLink(number || fallback, whatsappMessage(context, data?.general.siteName));
  const label = children ?? 'WhatsApp';

  if (!href) {
    return (
      <span
        title="WhatsApp number not configured yet — Super Admin can add it in System Settings"
        className={cn(buttonClass(variant, size, className), 'cursor-not-allowed opacity-50')}
        aria-disabled="true"
      >
        <MessageCircle className="h-4 w-4" />
        {!iconOnly && label}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} aria-label={iconOnly ? 'WhatsApp' : undefined}>
      <MessageCircle className="h-4 w-4" />
      {!iconOnly && label}
    </a>
  );
}
