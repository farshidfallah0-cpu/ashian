import {
  AMENITY_CATEGORIES,
  LABELS,
  formatArea,
  formatDate,
  formatNumber,
  formatPrice,
  sqftToSqm,
  toPersianDigits,
  type ListingDetail,
} from '@ashian/shared';
import {
  Armchair,
  Balloon,
  Barbell,
  Bathtub,
  Bed,
  Bell,
  Boat,
  Books,
  Broom,
  Buildings,
  CalendarBlank,
  Car,
  Check,
  City,
  CoatHanger,
  CookingPot,
  Door,
  Dresser,
  Fire,
  FlagBanner,
  House,
  PawPrint,
  Ruler,
  ShieldCheck,
  Stairs,
  SwimmingPool,
  Thermometer,
  Waves,
  Wind,
} from '@phosphor-icons/react/ssr';
import type { Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

/** بخش صفحه با تیتر و خط جداکننده‌ی نازک */
export function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="border-t border-line py-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} className="font-display text-2xl text-ink">
        {title}
      </h2>
      {lead && <p className="mt-1.5 text-base text-muted">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ───────────── مشخصات کلیدی ───────────── */

export function KeySpecs({ listing }: { listing: ListingDetail }) {
  const sqm = Math.round(sqftToSqm(listing.areaSqft));
  const items: Array<{ icon: Icon; value: string; sub?: string; label: string }> = [
    {
      icon: Bed,
      value: listing.bedrooms === 0 ? 'استودیو' : formatNumber(listing.bedrooms, 0),
      label: 'خواب',
    },
    { icon: Bathtub, value: formatNumber(listing.bathrooms, 0), label: 'حمام' },
    {
      icon: Ruler,
      value: formatNumber(listing.areaSqft, 0),
      sub: `${formatNumber(sqm, 0)} متر مربع`,
      label: 'فوت مربع',
    },
    { icon: House, value: LABELS.propertyType[listing.propertyType], label: 'نوع ملک' },
    { icon: Armchair, value: LABELS.furnishing[listing.furnishing], label: 'مبلمان' },
  ];
  if (listing.parkingSpaces > 0) {
    items.push({ icon: Car, value: formatNumber(listing.parkingSpaces, 0), label: 'پارکینگ' });
  }
  if (listing.floor !== null) {
    items.push({
      icon: Stairs,
      value: listing.floor === 0 ? 'همکف' : formatNumber(listing.floor, 0),
      label: 'طبقه',
    });
  }
  if (listing.buildYear) {
    items.push({ icon: CalendarBlank, value: toPersianDigits(listing.buildYear), label: 'سال ساخت' });
  }

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-3 bg-bg p-5">
          <item.icon size={26} weight="light" className="text-brand" aria-hidden />
          <div>
            <dd className="font-display text-lg leading-tight text-ink">{item.value}</dd>
            {item.sub && <dd className="text-xs text-muted">{item.sub}</dd>}
            <dt className="mt-0.5 text-sm text-muted">{item.label}</dt>
          </div>
        </div>
      ))}
    </dl>
  );
}

/* ───────────── توضیحات ───────────── */

const CLAMP_THRESHOLD = 480;

/** «بیشتر بخوانید» بدون JavaScript: چک‌باکس مخفی + peer. متن کامل همیشه در HTML است (سئو). */
export function Description({ text }: { text: string }) {
  if (!text.trim()) return null;
  const long = text.length > CLAMP_THRESHOLD;
  return (
    <div>
      <input id="description-toggle" type="checkbox" className="peer sr-only" />
      <div
        className={`whitespace-pre-line text-base leading-8 text-ink-2 ${
          long ? 'line-clamp-6 peer-checked:line-clamp-none' : ''
        }`}
      >
        {text}
      </div>
      {long && (
        <>
          <label
            htmlFor="description-toggle"
            className="mt-3 inline-block cursor-pointer text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink peer-checked:hidden peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
          >
            بیشتر بخوانید
          </label>
        </>
      )}
    </div>
  );
}

/* ───────────── جزئیات (جدول مشخصات) ───────────── */

export function DetailsTable({ listing }: { listing: ListingDetail }) {
  const rows: Array<[string, ReactNode]> = [
    ['نوع معامله', LABELS.dealType[listing.dealType]],
    ['نوع ملک', LABELS.propertyType[listing.propertyType]],
    ['متراژ', `${formatArea(listing.areaSqft, 'sqft')} (${formatArea(listing.areaSqft, 'sqm')})`],
    ['قیمت هر فوت مربع', formatPrice(listing.pricePerSqft, { compact: false })],
    ['مبلمان', LABELS.furnishing[listing.furnishing]],
  ];
  if (listing.floor !== null) rows.push(['طبقه', listing.floor === 0 ? 'همکف' : formatNumber(listing.floor, 0)]);
  if (listing.buildYear)
    rows.push(['سال ساخت', toPersianDigits(listing.buildYear)]);
  rows.push(['پارکینگ', listing.parkingSpaces ? formatNumber(listing.parkingSpaces, 0) : 'ندارد']);
  rows.push([
    'شماره‌ی مجوز تبلیغ (Permit)',
    listing.permitNumber ? (
      <span dir="ltr" className="font-sans">
        {listing.permitNumber}
      </span>
    ) : (
      <span className="text-muted">ثبت نشده</span>
    ),
  ]);
  if (listing.publishedAt) rows.push(['تاریخ انتشار', formatDate(listing.publishedAt, 'long')]);
  rows.push(['آخرین به‌روزرسانی', formatDate(listing.updatedAt, 'long')]);

  return (
    <dl className="grid gap-x-12 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5">
          <dt className="text-base text-muted">{label}</dt>
          <dd className="text-end text-base text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────── امکانات ───────────── */

/** آیکون هر امکان از نامی که در دیتابیس آمده؛ فقط آیکون‌های لازم import می‌شوند (سرور، بدون JS) */
const AMENITY_ICONS: Record<string, Icon> = {
  SwimmingPool,
  Barbell,
  ShieldCheck,
  Bell,
  Balloon,
  Thermometer,
  Fire,
  Waves,
  Car,
  Door,
  Wind,
  Broom,
  Books,
  CookingPot,
  Boat,
  Buildings,
  City,
  FlagBanner,
  PawPrint,
  // نام‌هایی در داده‌ی امکانات که در Phosphor نامی دیگر دارند
  Cabinet: Dresser,
  Hanger: CoatHanger,
};

export function Amenities({ items }: { items: ListingDetail['amenities'] }) {
  if (items.length === 0) return null;
  const groups = AMENITY_CATEGORIES.map((category) => ({
    category,
    items: items.filter((a) => a.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-9">
      {groups.map((group) => (
        <div key={group.category}>
          <h3 className="mb-4 font-sans text-base font-bold text-ink">
            {LABELS.amenityCategory[group.category]}
          </h3>
          <ul className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((amenity) => {
              const IconComponent = (amenity.icon && AMENITY_ICONS[amenity.icon]) || Check;
              return (
                <li key={amenity.id} className="flex items-center gap-3 text-base text-ink-2">
                  <IconComponent size={22} weight="light" className="shrink-0 text-brand" aria-hidden />
                  {amenity.nameFa}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
