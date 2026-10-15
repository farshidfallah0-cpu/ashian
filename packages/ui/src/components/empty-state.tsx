import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** تصویرسازی خطی: دو ساختمان، خط زمین و یک نقطه‌ی تأکید. بدون ایموجی، بدون رنگ پر. */
export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 130"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-28 w-auto text-line-strong', className)}
      aria-hidden="true"
    >
      <path d="M12 118h176" />
      {/* برج بلند */}
      <path d="M44 118V30h52v88" />
      <path d="M44 30l26-14 26 14" />
      <path d="M56 46h8M76 46h8M56 62h8M76 62h8M56 78h8M76 78h8M56 94h8M76 94h8" />
      <path d="M64 118v-12h12v12" />
      {/* ساختمان کوتاه */}
      <path d="M108 118V70h44v48" />
      <path d="M118 84h8M134 84h8M118 100h8M134 100h8" />
      {/* ذره‌بین */}
      <circle cx="158" cy="44" r="14" className="text-ink-2" />
      <path d="m168 54 12 12" className="text-ink-2" strokeWidth="2" />
      <circle cx="158" cy="44" r="3" className="fill-accent stroke-none" />
    </svg>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-5 px-6 py-16 text-center', className)}>
      <EmptyIllustration />
      <div className="flex max-w-sm flex-col gap-2">
        <h3 className="text-xl text-ink">{title}</h3>
        {description && <p className="text-base text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
