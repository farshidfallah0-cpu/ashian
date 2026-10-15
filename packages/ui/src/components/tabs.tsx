'use client';

import { formatNumber } from '@ashian/shared';
import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root dir="rtl" className={cn('flex flex-col', className)} {...props} />;
}

/** نوار تب با خط زیرین؛ بدون قرص و پس‌زمینه. روی موبایل افقی اسکرول می‌شود. */
export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('scrollbar-none flex gap-7 overflow-x-auto border-b border-line', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  count,
  children,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger> & { count?: number }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative -mb-px flex h-12 shrink-0 items-center gap-2 border-b-2 border-transparent text-base text-muted',
        'transition-[color,border-color] duration-150 ease-out hover:text-ink',
        'data-[state=active]:border-brand data-[state=active]:font-medium data-[state=active]:text-ink',
        'focus-visible:outline-offset-[-2px]',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <span className="text-xs text-muted">{formatNumber(count, 0)}</span>}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn('pt-6 data-[state=active]:animate-fade-in', className)}
      {...props}
    />
  );
}
