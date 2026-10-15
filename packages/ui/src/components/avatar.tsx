'use client';

import { SealCheck } from '@phosphor-icons/react/ssr';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '../lib/cn';

const sizes = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
} as const;

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  /** مشاور تأییدشده */
  verified?: boolean;
  className?: string;
}

/** حروف اول اسم؛ نیم‌فاصله‌ها نادیده گرفته می‌شوند */
export function initials(name: string): string {
  const parts = name.replace(/‌/g, ' ').trim().split(/\s+/).filter(Boolean);
  const first = [...(parts[0] ?? '')][0] ?? '';
  const last = parts.length > 1 ? ([...(parts[parts.length - 1] ?? '')][0] ?? '') : '';
  return first + (last ? '‌' + last : '');
}

export function Avatar({ name, src, size = 'md', verified, className }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <AvatarPrimitive.Root
        className={cn(
          'inline-flex select-none items-center justify-center overflow-hidden rounded-full bg-surface-2 font-medium text-brand',
          sizes[size],
        )}
      >
        {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} aria-label={name}>
          {initials(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {verified && (
        <SealCheck
          weight="fill"
          aria-label="تأییدشده"
          className="absolute -bottom-0.5 -end-0.5 size-[38%] min-h-3.5 min-w-3.5 rounded-full bg-bg text-verified"
        />
      )}
    </span>
  );
}
