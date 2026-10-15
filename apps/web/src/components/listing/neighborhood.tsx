import {
  LABELS,
  bedroomsLabel,
  formatNumber,
  formatPrice,
  type ListingDetail,
  type NeighborhoodStats,
} from '@ashian/shared';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { communityHref } from '../../lib/listing-seo';

/** «۱۲٪ پایین‌تر از میانگین» / «۵٪ بالاتر از میانگین» / «نزدیک به میانگین» */
function deltaText(percent: number): string {
  if (Math.abs(percent) < 3) return 'نزدیک به میانگین';
  return `${formatNumber(Math.abs(percent), 0)}٪ ${percent < 0 ? 'پایین‌تر' : 'بالاتر'} از میانگین`;
}

function Bar({
  label,
  value,
  max,
  strong,
}: {
  label: string;
  value: number;
  max: number;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-4 text-base">
        <span className={strong ? 'text-ink' : 'text-muted'}>{label}</span>
        <span className={strong ? 'font-bold text-ink' : 'text-ink-2'}>{formatPrice(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-2" aria-hidden>
        <div
          className={`h-full rounded-full ${strong ? 'bg-brand' : 'bg-line-strong'}`}
          style={{ width: `${Math.max(3, Math.min(100, (value / max) * 100))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * اطلاعات محله: میانگین قیمت هم‌نوع و هم‌تعداد خواب و مقایسه‌ی همین آگهی با آن.
 * داده از آگهی‌های فعال محله است (محاسبه‌ی تجمیعی و کش‌شده در API).
 */
export function NeighborhoodSection({
  listing,
  stats,
}: {
  listing: ListingDetail;
  stats: NeighborhoodStats;
}) {
  const { all, sameBedrooms } = stats;
  const dealLabel = LABELS.dealType[stats.dealType];
  const max = Math.max(listing.price, sameBedrooms?.avgPrice ?? 0);
  const period = listing.dealType === 'rent' ? 'سالانه' : listing.dealType === 'short_term' ? 'هر شب' : '';

  return (
    <div>
      <p className="max-w-2xl text-base text-ink-2">
        بر پایه‌ی {formatNumber(all.count, 0)} آگهی فعال {dealLabel} در {stats.community.nameFa}.
        {period && ` قیمت‌ها ${period} و به درهم‌اند.`}
      </p>

      {sameBedrooms && (
        <div className="mt-7 grid max-w-2xl gap-5">
          <Bar label="این آگهی" value={listing.price} max={max} strong />
          <Bar
            label={`میانگین ${bedroomsLabel(listing.bedrooms)} در محله (${formatNumber(sameBedrooms.count, 0)} آگهی)`}
            value={sameBedrooms.avgPrice}
            max={max}
          />
          {listing.dealType !== 'full_mortgage' && stats.priceDeltaPercent !== null && (
            <p className="text-base text-ink">
              قیمت این آگهی{' '}
              <span
                className={`font-bold ${stats.priceDeltaPercent <= -3 ? 'text-verified' : 'text-ink'}`}
              >
                {deltaText(stats.priceDeltaPercent)}
              </span>{' '}
              آگهی‌های هم‌تعداد خواب است.
            </p>
          )}
        </div>
      )}

      <dl className="mt-9 grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-3">
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">میانه‌ی قیمت در محله</dt>
          <dd className="mt-1 font-display text-xl text-ink">{formatPrice(all.medianPrice)}</dd>
        </div>
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">میانگین هر فوت مربع</dt>
          <dd className="mt-1 font-display text-xl text-ink">
            {formatPrice(all.avgPricePerSqft, { compact: false })}
          </dd>
          {stats.psfDeltaPercent !== null && (
            <dd className="mt-0.5 text-sm text-muted">
              این آگهی: {formatPrice(listing.pricePerSqft, { compact: false })} (
              {deltaText(stats.psfDeltaPercent)})
            </dd>
          )}
        </div>
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">آگهی فعال هم‌نوع</dt>
          <dd className="mt-1 font-display text-xl text-ink">{formatNumber(all.count, 0)}</dd>
        </div>
      </dl>

      <Link
        href={communityHref(listing)}
        prefetch={false}
        className="group mt-6 inline-flex items-center gap-2 text-base text-ink"
      >
        <span className="underline decoration-line-strong underline-offset-[6px] group-hover:decoration-ink">
          آگهی‌های {dealLabel} در {stats.community.nameFa}
        </span>
        <ArrowLeft
          size={16}
          className="transition-transform duration-200 ease-out group-hover:-translate-x-1"
          aria-hidden
        />
      </Link>
    </div>
  );
}
