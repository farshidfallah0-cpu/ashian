import { Badge, PriceText } from '@ashian/ui';
import {
  LABELS,
  bedroomsLabel,
  formatNumber,
  formatRelative,
  type RentPeriod,
} from '@ashian/shared';
import { Bathtub, Bed, Ruler } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiListingCard } from '../../lib/account-api';
import { MediaImage } from '../media-image';

const PERIOD: Partial<Record<ApiListingCard['dealType'], RentPeriod>> = {
  rent: 'yearly',
  short_term: 'daily',
};

const STATUS_TONE: Record<string, string> = {
  active: 'bg-verified-soft text-verified',
  pending_review: 'bg-accent-soft text-accent-active',
  draft: 'bg-surface-2 text-ink-2',
  rejected: 'bg-danger-soft text-danger',
  expired: 'bg-surface-2 text-muted',
};

/** کارت آگهی در پنل کاربر؛ `actions` زیر کارت می‌آید (حذف از علاقه‌مندی و …) */
export function AccountCard({
  listing,
  showStatus = false,
  actions,
}: {
  listing: ApiListingCard;
  showStatus?: boolean;
  actions?: ReactNode;
}) {
  const href = `/listings/${listing.publicId}`;
  const live = listing.status === 'active';
  return (
    <article>
      <Link href={href} prefetch={false} className="group block rounded-sm outline-offset-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
          <MediaImage
            variants={listing.cover?.variants}
            blurhash={listing.cover?.blurhash}
            width={listing.cover?.width}
            height={listing.cover?.height}
            alt={listing.title}
            sizes="(min-width: 1024px) 28vw, (min-width: 640px) 45vw, 92vw"
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          <div className="absolute start-2.5 top-2.5 flex flex-wrap gap-1.5">
            {showStatus && (
              <span
                className={`inline-flex h-6 items-center rounded-sm px-2 text-xs font-medium ${STATUS_TONE[listing.status] ?? ''}`}
              >
                {LABELS.listingStatus[listing.status]}
              </span>
            )}
            {listing.isVerified && <Badge kind="verified" />}
          </div>
        </div>
        <div className="mt-3.5 flex items-baseline justify-between gap-3">
          <PriceText amount={listing.price} period={PERIOD[listing.dealType]} size="md" />
          <span className="shrink-0 text-xs text-muted">{LABELS.dealType[listing.dealType]}</span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 min-h-[3.2em] font-sans text-base font-medium leading-[1.6] text-ink">
          {listing.title}
        </h3>
        <p className="mt-1 truncate text-sm text-muted">{listing.community.nameFa}</p>
        <ul className="mt-2 flex items-center gap-4 text-sm text-ink-2">
          <li className="flex items-center gap-1.5">
            <Bed size={16} aria-hidden />
            {listing.bedrooms === 0 ? 'استودیو' : formatNumber(listing.bedrooms, 0)}
            <span className="sr-only">{bedroomsLabel(listing.bedrooms)}</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Bathtub size={16} aria-hidden />
            {formatNumber(listing.bathrooms, 0)}
            <span className="sr-only">حمام</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Ruler size={16} aria-hidden />
            {formatNumber(listing.areaSqft, 0)} فوت
          </li>
        </ul>
      </Link>
      <div className="mt-3 flex min-h-9 items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
        <span className="min-w-0 truncate">
          {listing.agent?.name ?? 'مالک'}
          {listing.publishedAt && live && <> · {formatRelative(listing.publishedAt)}</>}
        </span>
        {actions}
      </div>
    </article>
  );
}

/** صفحه‌بندی ساده‌ی قبلی/بعدی با لینک (سرور) */
export function PageNav({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const link =
    'inline-flex h-10 items-center rounded-sm border border-line-strong px-4 text-sm text-ink hover:border-ink';
  return (
    <nav aria-label="صفحه‌بندی" className="mt-10 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} prefetch={false} className={link}>
          قبلی
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        صفحه‌ی {formatNumber(page, 0)} از {formatNumber(totalPages, 0)}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} prefetch={false} className={link}>
          بعدی
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** عنوان صفحه‌ی پنل */
export function PanelHeading({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <h1 className="font-display text-2xl text-ink md:text-3xl">{title}</h1>
        {lead && <p className="mt-1.5 max-w-xl text-base text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** حالت خالی با پیوند ادامه */
export function PanelEmpty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-sm border border-dashed border-line-strong px-6 py-14">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="mt-2 max-w-md text-base text-muted">{text}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}