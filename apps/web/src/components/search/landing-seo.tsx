import {
  LABELS,
  PROPERTY_TYPES,
  bedroomsLabel,
  formatNumber,
  formatPrice,
  type SearchResponse,
} from '@ashian/shared';
import Link from 'next/link';
import { landingPath, type LandingSpec } from '../../lib/landing';
import type { PlaceInfo } from '../../lib/search-server';

const DEAL_NOUN = { rent: 'اجاره', sale: 'خرید' } as const;

/** جمله‌های توضیح یکتا بر اساس داده‌ی واقعی همین ترکیب (تعداد، بازه‌ی قیمت) */
export function landingIntro(
  spec: LandingSpec,
  heading: string,
  data: SearchResponse,
  places: PlaceInfo[],
): string {
  const place = places.find((p) => p.path === spec.location);
  const price = data.facets?.price;
  const unit = spec.deal === 'rent' ? 'در سال' : '';
  const parts = [
    data.total > 0
      ? `هم‌اکنون ${formatNumber(data.total, 0)} آگهی برای «${heading}» در آشیان فعال است.`
      : `در حال حاضر آگهی فعالی برای «${heading}» ثبت نشده است؛ می‌توانید فیلترها را باز کنید یا هشدار آگهی تازه بگیرید.`,
  ];
  if (price && data.total > 0) {
    parts.push(
      `قیمت‌ها از ${formatPrice(price.min)} تا ${formatPrice(price.max)} ${unit}`.trim() +
        ' است و همه‌ی قیمت‌ها فقط به درهم امارات نمایش داده می‌شود.',
    );
  }
  if (place && place.type !== 'emirate') {
    parts.push(
      `${place.nameFa} (${place.nameEn}) در مجموع ${formatNumber(place.listingCount, 0)} آگهی فعال دارد.`,
    );
  }
  parts.push('هر آگهی با تاریخ انتشار، نام مشاور و شماره‌ی مجوز قابل بررسی است.');
  return parts.join(' ');
}

/**
 * متن یکتا و لینک‌های داخلی صفحه‌ی لندینگ: نوع‌های دیگر در همین محله، همین نوع در محله‌های پرآگهی دیگر،
 * و تعداد خواب‌های دیگر. لینک‌ها URL تمیز دارند و موتور جستجو به آن‌ها می‌رسد.
 */
export function LandingSeo({
  spec,
  heading,
  data,
  places,
}: {
  spec: LandingSpec;
  heading: string;
  data: SearchResponse;
  places: PlaceInfo[];
}) {
  const topCommunities = places
    .filter((p) => p.type === 'community' && p.listingCount > 0 && p.path !== spec.location)
    .sort((a, b) => b.listingCount - a.listingCount)
    .slice(0, 8);
  const here = places.find((p) => p.path === spec.location);

  return (
    <section aria-labelledby="landing-about" className="mt-16 border-t border-ink pt-8">
      <h2 id="landing-about" className="text-xl md:text-2xl">
        درباره‌ی {heading}
      </h2>
      <p className="mt-3 max-w-3xl text-base leading-8 text-ink-2">
        {landingIntro(spec, heading, data, places)}
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-3">
        <nav aria-label="نوع ملک">
          <h3 className="font-sans text-base font-bold text-ink">
            نوع ملک{here ? ` در ${here.nameFa}` : ''}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {PROPERTY_TYPES.filter((t) => t !== spec.propertyType).map((type) => (
              <li key={type}>
                <Link
                  href={landingPath({
                    deal: spec.deal,
                    propertyType: type,
                    location: spec.location,
                  })}
                  prefetch={false}
                  className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                >
                  {DEAL_NOUN[spec.deal]} {LABELS.propertyType[type]}
                  {here ? ` در ${here.nameFa}` : ''}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="تعداد خواب">
          <h3 className="font-sans text-base font-bold text-ink">تعداد خواب</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {[0, 1, 2, 3, 4]
              .filter((n) => n !== spec.bedrooms)
              .map((n) => (
                <li key={n}>
                  <Link
                    href={landingPath({
                      deal: spec.deal,
                      propertyType: spec.propertyType,
                      bedrooms: n,
                      location: spec.location,
                    })}
                    prefetch={false}
                    className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                  >
                    {DEAL_NOUN[spec.deal]} {LABELS.propertyType[spec.propertyType ?? 'apartment']}{' '}
                    {bedroomsLabel(n)}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>

        <nav aria-label="محله‌های دیگر">
          <h3 className="font-sans text-base font-bold text-ink">محله‌های پرآگهی</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {topCommunities.map((place) => (
              <li key={place.path}>
                <Link
                  href={landingPath({
                    deal: spec.deal,
                    propertyType: spec.propertyType,
                    bedrooms: spec.bedrooms,
                    location: place.path,
                  })}
                  prefetch={false}
                  className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                >
                  {place.nameFa}
                  <span className="text-muted"> · {formatNumber(place.listingCount, 0)} آگهی</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
