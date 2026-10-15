import { Medal, SealCheck, Star } from '@phosphor-icons/react/ssr';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export type BadgeKind = 'verified' | 'featured' | 'new' | 'topAgent';

const kinds: Record<BadgeKind, { label: string; icon: ReactNode; className: string }> = {
  verified: {
    label: 'تأییدشده',
    icon: <SealCheck size={14} weight="fill" />,
    className: 'bg-verified-soft text-verified',
  },
  featured: {
    label: 'ویژه',
    icon: <Star size={12} weight="fill" />,
    className: 'bg-accent-soft text-accent-active',
  },
  new: {
    label: 'جدید',
    icon: <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />,
    className: 'bg-ink text-white',
  },
  topAgent: {
    label: 'مشاور برتر',
    icon: <Medal size={14} weight="fill" />,
    className: 'bg-brand-soft text-brand',
  },
};

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  kind: BadgeKind;
  /** متن سفارشی به‌جای متن پیش‌فرض */
  children?: ReactNode;
  /** فقط آیکون؛ برای جاهای تنگ مثل روی عکس کارت */
  compact?: boolean;
}

/** برچسب وضعیت: هر نوع هم رنگ و هم آیکون دارد تا فقط به رنگ وابسته نباشد. */
export function Badge({ kind, children, compact = false, className, ...props }: BadgeProps) {
  const spec = kinds[kind];
  const text = children ?? spec.label;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium leading-none',
        spec.className,
        className,
      )}
      {...props}
    >
      {spec.icon}
      {compact ? <span className="sr-only">{text}</span> : text}
    </span>
  );
}
