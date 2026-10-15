'use client';

import { formatNumber } from '@ashian/shared';
import { X } from '@phosphor-icons/react/ssr';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../lib/cn';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  /** تعداد آگهی کنار گزینه؛ کاربر قبل از کلیک می‌داند چه انتظاری دارد */
  count?: number;
  selected?: boolean;
  /** چیپ فیلتر فعال با دکمه‌ی حذف */
  onRemove?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * چیپ فیلتر. مستطیلی با گوشه‌ی ۴ (نه قرص گرد) تا شبیه برچسب نشریه باشد، نه دکمه‌ی اپلیکیشن.
 * وضعیت انتخاب با aria-pressed برای صفحه‌خوان اعلام می‌شود.
 */
export function Chip({
  children,
  count,
  selected = false,
  onRemove,
  className,
  type = 'button',
  ref,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-9 shrink-0 items-stretch overflow-hidden rounded-sm border text-sm',
        'transition-[background-color,border-color,color] duration-150 ease-out',
        selected
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-bg text-ink hover:border-ink',
        className,
      )}
    >
      <button
        ref={ref}
        type={type}
        aria-pressed={onRemove ? undefined : selected}
        className="inline-flex items-center gap-2 px-3 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-offset-[-3px]"
        {...props}
      >
        <span>{children}</span>
        {count !== undefined && (
          <span className={cn('text-xs', selected ? 'text-white/70' : 'text-muted')}>
            {formatNumber(count, 0)}
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label="حذف فیلتر"
          onClick={onRemove}
          className="flex w-8 items-center justify-center border-s border-white/20 hover:bg-white/10"
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </span>
  );
}
