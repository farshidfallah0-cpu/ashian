import { Badge, PriceText } from '@ashian/ui';
import {
  LABELS,
  bedroomsLabel,
  formatNumber,
  formatRelative,
  sqftToSqm,
  type RentPeriod,
  type SearchCard,
} from '@ashian/shared';
import { Bathtub, Bed, Ruler } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { MediaImage } from './media-image';

const PERIOD: Partial<Record<SearchCard['dealType'], RentPeriod>> = {
  rent: 'yearly',
  short_term: 'daily',
};

interface ListingCardProps {
  listing: SearchCard;
  /** برای عکس‌های بالای صفحه */
  sizes?: string;
  className?: string;
}

/**
 * کارت آگهی. طبق قانون محصول، تاریخ انتشار و مشاور همیشه روی کارت دیده می‌شوند
 * و قیمت فقط با یک ارز (درهم) نمایش داده می‌شود.
 */
export function ListingCard({
  listing,
  sizes = '(min-width: 1024px) 300px, 80vw',
  className,
}: ListingCardProps) {
  const place = listing.tower ?? listing.community;
  const agent = listing.agent;
  const sqm = Math.round(sqftToSqm(listing.areaSqft));
  return (
    <article className={className}>
      <Link
        href={`/listings/${listing.publicId}`}
        prefetch={false}
        className="group block rounded-sm outline-offset-4"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
          <MediaImage
            variants={listing.cover?.variants}
            blurhash={listing.cover?.blurhash}
            width={listing.cover?.width}
            height={listing.cover?.height}
            alt={listing.title}
            sizes={sizes}
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
          />
          <div className="absolute start-2.5 top-2.5 flex gap-1.5">
            {listing.isVerified && <Badge kind="verified" />}
          </div>
        </div>

        <div className="mt-3.5 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <PriceText amount={listing.price} period={PERIOD[listing.dealType]} size="md" />
            <span className="shrink-0 text-xs text-muted">{LABELS.dealType[listing.dealType]}</span>
          </div>
          <h3 className="line-clamp-2 min-h-[3.2em] font-sans text-base font-medium leading-[1.6] text-ink">
            {listing.title}
          </h3>
          <p className="truncate text-sm text-muted">
            {place.nameFa}
            {listing.tower && <span> · {listing.community.nameFa}</span>}
          </p>
          <ul className="mt-1 flex items-center gap-4 text-sm text-ink-2">
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
              <span>
                {formatNumber(listing.areaSqft, 0)} فوت
                <span className="text-muted"> ({formatNumber(sqm, 0)} متر)</span>
              </span>
            </li>
          </ul>
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
        {agent ? (
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium text-brand"
            >
              {agent.name.trim().charAt(0)}
            </span>
            <span className="truncate text-ink-2">{agent.name}</span>
          </span>
        ) : (
          <span>مالک</span>
        )}
        {listing.publishedAt && (
          <time dateTime={listing.publishedAt} className="shrink-0">
            {formatRelative(listing.publishedAt)}
          </time>
        )}
      </div>
    </article>
  );
}
