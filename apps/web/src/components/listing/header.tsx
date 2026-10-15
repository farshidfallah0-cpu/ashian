import { Badge, PriceText } from '@ashian/ui';
import {
  LABELS,
  MARKET,
  formatCheques,
  formatDate,
  formatPrice,
  formatRelative,
  toPersianDigits,
  type ListingDetail,
} from '@ashian/shared';
import { Flag, GitDiff, Heart, MapPin, ShareNetwork } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { PRICE_PERIOD } from '../../lib/listing';
import { communityHref, placeName } from '../../lib/listing-seo';
import { ListingActions } from './listing-actions';

/**
 * سرصفحه: قیمت (فقط درهم)، عنوان، آدرس، برچسب‌ها، تاریخ انتشار، کد آگهی و کنش‌ها.
 * فقط ListingActions کلاینتی است؛ بقیه HTML ساده‌ی ISR است.
 */
export function ListingHeader({ listing }: { listing: ListingDetail }) {
  const isRent = listing.dealType === 'rent';
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        {listing.tier === 'featured' && <Badge kind="featured" />}
        {listing.isVerified && <Badge kind="verified" />}
        <span className="inline-flex h-6 items-center rounded-sm bg-surface px-2 text-xs text-ink-2">
          {LABELS.dealType[listing.dealType]}
        </span>
        <span className="inline-flex h-6 items-center rounded-sm bg-surface px-2 text-xs text-ink-2">
          {LABELS.propertyType[listing.propertyType]}
        </span>
        <span className="inline-flex h-6 items-center rounded-sm bg-surface px-2 text-xs text-ink-2">
          {LABELS.furnishing[listing.furnishing]}
        </span>
      </div>

      <div className="mt-5">
        <PriceText amount={listing.price} period={PRICE_PERIOD[listing.dealType]} size="xl" />
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          {isRent && (
            <div className="flex gap-1.5">
              <dt>اجاره‌ی ماهانه معادل</dt>
              <dd className="text-ink-2">{formatPrice(Math.round(listing.price / 12))}</dd>
            </div>
          )}
          {isRent && listing.rentCheques.length > 0 && (
            <div className="flex gap-1.5">
              <dt>پرداخت</dt>
              <dd className="text-ink-2">
                {listing.rentCheques
                  .filter((n) => MARKET.rent.chequeOptions.includes(n))
                  .sort((a, b) => a - b)
                  .map((n) => formatCheques(n))
                  .join('، ')}
              </dd>
            </div>
          )}
          {isRent && listing.deposit !== null && listing.deposit > 0 && (
            <div className="flex gap-1.5">
              <dt>ودیعه</dt>
              <dd className="text-ink-2">{formatPrice(listing.deposit)}</dd>
            </div>
          )}
          {listing.dealType === 'sale' && (
            <div className="flex gap-1.5">
              <dt>هر فوت مربع</dt>
              <dd className="text-ink-2">{formatPrice(listing.pricePerSqft, { compact: false })}</dd>
            </div>
          )}
        </dl>
      </div>

      <h1 className="mt-6 text-balance font-display text-3xl leading-[1.35] text-ink lg:text-4xl">
        {listing.title}
      </h1>

      <p className="mt-3 flex items-center gap-1.5 text-base text-ink-2">
        <MapPin size={18} className="shrink-0 text-muted" aria-hidden />
        <Link
          href={communityHref(listing)}
          prefetch={false}
          className="underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
        >
          {placeName(listing)}
        </Link>
        <span className="text-muted">· دبی</span>
      </p>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {listing.publishedAt && (
          <span>
            منتشر شده{' '}
            <time dateTime={listing.publishedAt} title={formatDate(listing.publishedAt, 'long')}>
              {formatRelative(listing.publishedAt)}
            </time>
          </span>
        )}
        <span>
          کد آگهی{' '}
          <span className="font-sans text-ink-2">
            {toPersianDigits(listing.code)}
          </span>
        </span>
      </p>

      <div className="mt-5 border-t border-line pt-3">
        <ListingActions
          publicId={listing.publicId}
          title={listing.title}
          icons={{
            share: <ShareNetwork size={18} aria-hidden />,
            heart: <Heart size={18} aria-hidden />,
            heartFilled: <Heart size={18} weight="fill" className="text-danger" aria-hidden />,
            compare: <GitDiff size={18} aria-hidden />,
            flag: <Flag size={18} aria-hidden />,
          }}
        />
      </div>
    </header>
  );
}
