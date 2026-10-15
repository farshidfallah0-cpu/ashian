import {
  NEARBY_CATEGORIES,
  NEARBY_LABELS,
  formatNumber,
  type ListingDetail,
  type NearbyCategory,
  type NearbyPlace,
} from '@ashian/shared';
import {
  FirstAidKit,
  GraduationCap,
  Storefront,
  Train,
} from '@phosphor-icons/react/ssr';
import type { Icon } from '@phosphor-icons/react';
import { placeName } from '../../lib/listing-seo';
import { LocationMap, type MapMarker } from './location-map';

const CATEGORY_ICON: Record<NearbyCategory, Icon> = {
  metro: Train,
  school: GraduationCap,
  hospital: FirstAidKit,
  mall: Storefront,
};

/** فاصله‌ی خوانا: «۲۴۰ متر» یا «۲٫۱ کیلومتر» */
function distanceText(meters: number): string {
  if (meters < 1000) return `${formatNumber(Math.max(10, Math.round(meters / 10) * 10), 0)} متر`;
  return `${formatNumber(Math.round(meters / 100) / 10, 1)} کیلومتر`;
}

const WALKABLE_MINUTES = 20;

/**
 * نقشه‌ی موقعیت (MapLibre، تنبل: فقط وقتی نزدیک دید کاربر شد بارگذاری می‌شود) و نزدیک‌ترین
 * مترو، مدرسه، بیمارستان و مرکز خرید. فاصله‌ها هوایی و تقریبی‌اند و همین‌طور نوشته می‌شوند.
 */
export function LocationSection({
  listing,
  nearby,
}: {
  listing: ListingDetail;
  nearby: NearbyPlace[];
}) {
  const groups = NEARBY_CATEGORIES.map((category) => ({
    category,
    items: nearby.filter((p) => p.category === category),
  })).filter((g) => g.items.length > 0);

  // روی نقشه فقط نزدیک‌ترین مورد هر دسته (شلوغ نشود)
  const markers: MapMarker[] = groups.map(({ category, items }) => ({
    lng: items[0]!.lng,
    lat: items[0]!.lat,
    label: `${NEARBY_LABELS[category]} · ${items[0]!.nameFa}`,
  }));

  return (
    <div>
      <p className="flex items-center gap-2 text-base text-ink-2">{placeName(listing)}، دبی</p>
      <div className="mt-5">
        <LocationMap
          lng={listing.coordinates.lng}
          lat={listing.coordinates.lat}
          markers={markers}
          title={listing.title}
        />
      </div>

      {groups.length > 0 && (
        <div className="mt-9 grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {groups.map(({ category, items }) => {
            const CategoryIcon = CATEGORY_ICON[category];
            return (
              <div key={category}>
                <h3 className="flex items-center gap-2.5 font-sans text-base font-bold text-ink">
                  <CategoryIcon size={22} weight="light" className="text-brand" aria-hidden />
                  {NEARBY_LABELS[category]}
                </h3>
                <ul className="mt-3 divide-y divide-line">
                  {items.map((place) => (
                    <li
                      key={place.nameEn}
                      className="flex items-baseline justify-between gap-4 py-2.5 text-base"
                    >
                      <span className="text-ink-2">{place.nameFa}</span>
                      <span className="shrink-0 text-sm text-muted">
                        {distanceText(place.distanceM)}
                        {place.walkMinutes <= WALKABLE_MINUTES &&
                          ` · ${formatNumber(place.walkMinutes, 0)} دقیقه پیاده`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {groups.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          فاصله‌ها هوایی و تقریبی‌اند؛ زمان پیاده‌روی با ضریب مسیر محاسبه شده است.
        </p>
      )}
    </div>
  );
}
