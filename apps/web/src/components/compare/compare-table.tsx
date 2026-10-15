import {
  LABELS,
  formatArea,
  formatDate,
  formatNumber,
  formatPrice,
  type CompareItem,
} from '@ashian/shared';
import { Check, Minus } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { MediaImage } from '../media-image';
import { CompareRemove } from './compare-remove';

interface Row {
  key: string;
  label: string;
  /** متن نمایشی هر ستون */
  value: (item: CompareItem) => string;
  /** برای برجسته کردن بهترین مقدار: کمترین یا بیشترین */
  best?: { by: (item: CompareItem) => number; prefer: 'min' | 'max'; label: string };
}

const sameDeal = (items: CompareItem[]) => items.every((i) => i.dealType === items[0]!.dealType);

const GROUPS: Array<{ title: string; rows: Row[] }> = [
  {
    title: 'قیمت',
    rows: [
      {
        key: 'price',
        label: 'قیمت',
        value: (i) =>
          `${formatPrice(i.price)}${i.dealType === 'rent' ? ' / سال' : i.dealType === 'short_term' ? ' / شب' : ''}`,
        best: { by: (i) => i.price, prefer: 'min', label: 'ارزان‌ترین' },
      },
      { key: 'deal', label: 'نوع معامله', value: (i) => LABELS.dealType[i.dealType] },
      {
        key: 'psf',
        label: 'هر فوت مربع',
        value: (i) => formatPrice(i.pricePerSqft, { compact: false }),
        best: { by: (i) => i.pricePerSqft, prefer: 'min', label: 'کمترین' },
      },
    ],
  },
  {
    title: 'ملک',
    rows: [
      { key: 'type', label: 'نوع ملک', value: (i) => LABELS.propertyType[i.propertyType] },
      {
        key: 'beds',
        label: 'خواب',
        value: (i) => (i.bedrooms === 0 ? 'استودیو' : formatNumber(i.bedrooms, 0)),
      },
      { key: 'baths', label: 'حمام', value: (i) => formatNumber(i.bathrooms, 0) },
      {
        key: 'area',
        label: 'متراژ',
        value: (i) => `${formatArea(i.areaSqft, 'sqft')} (${formatArea(i.areaSqft, 'sqm')})`,
        best: { by: (i) => i.areaSqft, prefer: 'max', label: 'بزرگ‌ترین' },
      },
      { key: 'furn', label: 'مبلمان', value: (i) => LABELS.furnishing[i.furnishing] },
      {
        key: 'floor',
        label: 'طبقه',
        value: (i) => (i.floor === null ? '—' : i.floor === 0 ? 'همکف' : formatNumber(i.floor, 0)),
      },
      {
        key: 'year',
        label: 'سال ساخت',
        value: (i) => (i.buildYear ? String(i.buildYear).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!) : '—'),
      },
      {
        key: 'parking',
        label: 'پارکینگ',
        value: (i) => (i.parkingSpaces ? formatNumber(i.parkingSpaces, 0) : 'ندارد'),
      },
    ],
  },
  {
    title: 'مکان و آگهی',
    rows: [
      { key: 'community', label: 'محله', value: (i) => i.community.nameFa },
      { key: 'tower', label: 'برج / مجتمع', value: (i) => i.tower?.nameFa ?? '—' },
      { key: 'permit', label: 'مجوز تبلیغ (Permit)', value: (i) => i.permitNumber ?? 'ثبت نشده' },
      { key: 'verified', label: 'آگهی تأییدشده', value: (i) => (i.isVerified ? 'بله' : 'خیر') },
      { key: 'agent', label: 'مشاور', value: (i) => i.agent?.name ?? 'مالک' },
      {
        key: 'published',
        label: 'تاریخ انتشار',
        value: (i) => (i.publishedAt ? formatDate(i.publishedAt, 'long') : '—'),
      },
    ],
  },
];

const CELL = 'min-w-[13rem] px-4 py-3.5 align-top text-base';
const LABEL_CELL =
  'sticky start-0 z-10 w-36 min-w-36 bg-bg px-4 py-3.5 text-start align-top text-sm font-normal text-muted';

/**
 * جدول مقایسه تا ۴ ملک. ردیف‌های یکسان با «فقط تفاوت‌ها» (چک‌باکس CSS، بدون JS) پنهان می‌شوند،
 * ردیف‌هایی که تفاوت دارند نشانه‌ی کوچک دارند و بهترین قیمت/متراژ برجسته می‌شود.
 */
export function CompareTable({ items }: { items: CompareItem[] }) {
  const ids = items.map((i) => i.publicId);
  const comparablePrice = sameDeal(items);

  // اتحاد امکانات: پرتکرارها اول
  const amenityCount = new Map<string, { nameFa: string; n: number }>();
  for (const item of items)
    for (const a of item.amenities) {
      const entry = amenityCount.get(a.slug) ?? { nameFa: a.nameFa, n: 0 };
      entry.n++;
      amenityCount.set(a.slug, entry);
    }
  const amenityRows = [...amenityCount.entries()].sort((a, b) => b[1].n - a[1].n);

  const bestOf = (row: Row): Set<string> => {
    const best = row.best;
    if (!best || items.length < 2) return new Set();
    if ((row.key === 'price' || row.key === 'psf') && !comparablePrice) return new Set();
    const values = items.map(best.by);
    const target = best.prefer === 'min' ? Math.min(...values) : Math.max(...values);
    if (values.every((v) => v === target)) return new Set();
    return new Set(items.filter((i) => best.by(i) === target).map((i) => i.publicId));
  };

  return (
    <div>
      <input id="only-diff" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="only-diff"
        className="mb-5 inline-flex cursor-pointer items-center gap-2.5 text-base text-ink-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand"
      >
        <span className="flex size-5 items-center justify-center rounded-sm border border-line-strong">
          <Check size={14} weight="bold" className="hidden text-brand [input:checked~label_&]:block" aria-hidden />
        </span>
        فقط تفاوت‌ها
      </label>

      <div className="overflow-x-auto border-y border-line peer-checked:[&_tr[data-same=true]]:hidden">
        <table className="w-full min-w-max border-collapse text-start">
          <caption className="sr-only">مقایسه‌ی ملک‌های انتخاب‌شده</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={LABEL_CELL}>
                <span className="sr-only">ویژگی</span>
              </th>
              {items.map((item) => (
                <th key={item.publicId} scope="col" className={`${CELL} font-normal`}>
                  <Link href={`/listings/${item.publicId}`} prefetch={false} className="group block">
                    <div className="aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
                      <MediaImage
                        variants={item.cover?.variants}
                        blurhash={item.cover?.blurhash}
                        width={item.cover?.width}
                        height={item.cover?.height}
                        alt={item.title}
                        sizes="240px"
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <span className="mt-3 line-clamp-2 block font-sans text-base font-medium leading-7 text-ink group-hover:underline">
                      {item.title}
                    </span>
                  </Link>
                  <div className="mt-1">
                    <CompareRemove publicId={item.publicId} ids={ids} title={item.title} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <GroupRows key={group.title} title={group.title} colSpan={items.length + 1}>
                {group.rows.map((row) => {
                  const values = items.map(row.value);
                  const same = values.every((v) => v === values[0]);
                  const best = bestOf(row);
                  return (
                    <tr key={row.key} data-same={same} className="border-b border-line last:border-b-0">
                      <th scope="row" className={LABEL_CELL}>
                        {row.label}
                        {!same && (
                          <span
                            className="ms-1.5 inline-block size-1.5 rounded-full bg-accent align-middle"
                            title="تفاوت"
                          />
                        )}
                      </th>
                      {items.map((item, i) => (
                        <td
                          key={item.publicId}
                          className={`${CELL} ${best.has(item.publicId) ? 'font-bold text-verified' : 'text-ink'}`}
                        >
                          {values[i]}
                          {best.has(item.publicId) && row.best && (
                            <span className="ms-2 text-xs font-normal">{row.best.label}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </GroupRows>
            ))}

            {amenityRows.length > 0 && (
              <GroupRows title="امکانات" colSpan={items.length + 1}>
                {amenityRows.map(([slug, { nameFa }]) => {
                  const has = items.map((i) => i.amenities.some((a) => a.slug === slug));
                  const same = has.every((v) => v === has[0]);
                  return (
                    <tr key={slug} data-same={same} className="border-b border-line last:border-b-0">
                      <th scope="row" className={LABEL_CELL}>
                        {nameFa}
                      </th>
                      {has.map((yes, i) => (
                        <td key={items[i]!.publicId} className={CELL}>
                          {yes ? (
                            <Check size={18} className="text-verified" aria-label="دارد" />
                          ) : (
                            <Minus size={18} className="text-faint" aria-label="ندارد" />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </GroupRows>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  title,
  colSpan,
  children,
}: {
  title: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={colSpan}
          scope="colgroup"
          className="sticky start-0 bg-surface px-4 py-2.5 text-start font-sans text-sm font-bold text-ink"
        >
          {title}
        </th>
      </tr>
      {children}
    </>
  );
}