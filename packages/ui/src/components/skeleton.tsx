import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * اسکلتون با شیمر سبک (فقط transform). ابعاد را با className بدهید تا
 * با محتوای نهایی یکی باشد و CLS ایجاد نشود.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('skeleton', className)} {...props} />;
}

/** اسکلتون کارت آگهی: هم‌اندازه‌ی کارت واقعی */
export function ListingCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      role="status"
      aria-label="در حال بارگذاری"
    >
      <Skeleton className="aspect-[4/3] w-full rounded-md" />
      <Skeleton className="h-6 w-2/5" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
    </div>
  );
}
