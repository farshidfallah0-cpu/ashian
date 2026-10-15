import { formatNumber } from '@ashian/shared';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { getPageRange } from './pagination-range';

type PageLinkProps = {
  href: string;
  className?: string;
  'aria-label'?: string;
  'aria-current'?: 'page';
  rel?: string;
  children?: ReactNode;
};

const DefaultLink = (props: PageLinkProps) => <a {...props} />;

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** آدرس واقعی هر صفحه؛ لینک‌های واقعی برای سئو و باز کردن در تب جدید */
  getHref: (page: number) => string;
  /** مثلاً next/link برای ناوبری سمت کلاینت */
  linkComponent?: ComponentType<PageLinkProps>;
  className?: string;
}

const itemClass =
  'flex size-10 items-center justify-center rounded-sm text-base transition-[background-color,color,transform] duration-150 active:scale-95';

export function Pagination({
  page,
  totalPages,
  getHref,
  linkComponent: Link = DefaultLink,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const items = getPageRange(page, totalPages);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const edge = (enabled: boolean, target: number, label: string, icon: ReactNode, rel: string) =>
    enabled ? (
      <Link
        href={getHref(target)}
        aria-label={label}
        rel={rel}
        className={cn(
          itemClass,
          'border border-line-strong text-ink hover:border-ink hover:bg-surface',
        )}
      >
        {icon}
      </Link>
    ) : (
      <span aria-hidden="true" className={cn(itemClass, 'border border-line text-faint')}>
        {icon}
      </span>
    );

  return (
    <nav
      aria-label="صفحه‌بندی"
      className={cn('flex items-center justify-center gap-1.5', className)}
    >
      {/* در راست‌چین «قبلی» سمت راست است و فلشش به راست اشاره می‌کند */}
      {edge(hasPrev, page - 1, 'صفحه‌ی قبل', <CaretRight size={16} />, 'prev')}
      <ul className="flex items-center gap-1">
        {items.map((item, i) =>
          item === 'gap' ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              className="flex size-10 items-center justify-center text-faint"
            >
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={getHref(item)}
                aria-label={`صفحه‌ی ${formatNumber(item, 0)}`}
                aria-current={item === page ? 'page' : undefined}
                className={cn(
                  itemClass,
                  item === page
                    ? 'bg-brand font-medium text-white'
                    : 'text-ink-2 hover:bg-surface hover:text-ink',
                )}
              >
                {formatNumber(item, 0)}
              </Link>
            </li>
          ),
        )}
      </ul>
      {edge(hasNext, page + 1, 'صفحه‌ی بعد', <CaretLeft size={16} />, 'next')}
    </nav>
  );
}
