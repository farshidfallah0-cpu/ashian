import { cn } from '@ashian/ui';
import {
  LABELS,
  PROPERTY_TYPES,
  formatNumber,
  formatPrice,
  toPersianDigits,
  type FacetOption,
  type HomeCommunity,
} from '@ashian/shared';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { MediaImage } from '../media-image';
import { Reveal } from '../reveal';
import { SectionHead } from './section-head';
import { PropertyTypeIcon } from './type-icons';

/* ───────────── نوع ملک ───────────── */

/**
 * شش کاشی با آیکون اختصاصی. شمارش کل درشت است و تفکیک اجاره/خرید زیرش؛
 * با هاور، آیکون کمی بالا می‌آید و فلش وارد می‌شود (فقط transform و opacity).
 */
export function PropertyTypeStrip({ rent, sale }: { rent: FacetOption[]; sale: FacetOption[] }) {
  const count = (list: FacetOption[], type: string) =>
    list.find((o) => o.value === type)?.count ?? 0;
  return (
    <section aria-labelledby="types-title" className="container-page py-12 md:py-16">
      <Reveal>
        <SectionHead
          id="types-title"
          title="چه نوع ملکی می‌خواهید؟"
          lead="تعداد آگهی فعال هر نوع، به تفکیک اجاره و خرید."
        />
      </Reveal>
      <Reveal>
        <ul className="scrollbar-none relative -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-6">
          {PROPERTY_TYPES.map((type) => {
            const rentCount = count(rent, type);
            const saleCount = count(sale, type);
            return (
              <li key={type} className="w-[10.75rem] shrink-0 snap-start md:w-auto">
                <Link
                  href={`/search?propertyType=${type}`}
                  prefetch={false}
                  className="group relative flex h-full flex-col overflow-hidden rounded-sm border border-line bg-bg p-5 transition-colors duration-200 hover:border-ink hover:bg-surface md:p-6"
                >
                  <PropertyTypeIcon
                    type={type}
                    className="block size-20 text-brand transition-transform duration-300 ease-out group-hover:-translate-y-1 md:size-24 [&>svg]:size-full"
                  />
                  <span className="mt-6 block font-display text-xl text-ink">
                    {LABELS.propertyType[type]}
                  </span>
                  <span className="mt-1 block font-sans text-2xl font-bold text-ink">
                    {formatNumber(rentCount + saleCount, 0)}
                    <span className="ms-1.5 text-sm font-normal text-muted">آگهی</span>
                  </span>
                  <span className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs text-muted">
                    <span>
                      اجاره
                      <span className="block font-sans text-sm font-bold text-ink-2">
                        {formatNumber(rentCount, 0)}
                      </span>
                    </span>
                    <span className="border-s border-line ps-3">
                      خرید
                      <span className="block font-sans text-sm font-bold text-ink-2">
                        {formatNumber(saleCount, 0)}
                      </span>
                    </span>
                  </span>
                  <ArrowLeft
                    size={18}
                    className="absolute start-5 top-5 -translate-x-1 text-ink opacity-0 transition-[transform,opacity] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 md:start-6 md:top-6"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}

/* ───────────── محله‌ها ───────────── */

/** جایگاه هر کارت در شبکه‌ی ۱۲ ستونی دسکتاپ؛ عمداً نامتقارن: دو کارت درشت، سه کارت متوسط */
const MOSAIC = [
  { span: 'lg:col-span-7', height: 'min-h-[22rem] lg:min-h-[28rem]', big: true },
  { span: 'lg:col-span-5', height: 'min-h-[22rem] lg:min-h-[28rem]', big: true },
  { span: 'lg:col-span-4', height: 'min-h-[16rem] lg:min-h-[20rem]', big: false },
  { span: 'lg:col-span-4', height: 'min-h-[16rem] lg:min-h-[20rem]', big: false },
  { span: 'lg:col-span-4', height: 'min-h-[16rem] lg:min-h-[20rem]', big: false },
] as const;

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-white/65">{label}</dt>
      <dd className="mt-0.5 truncate font-sans text-base font-bold text-white">
        {value}
        <span className="ms-1 text-xs font-normal text-white/70">{unit}</span>
      </dd>
    </div>
  );
}

/**
 * کارت محله: عکس تمام‌قاب با نام درشت و آمار روی خودش. ردیف پایین کارت تنها یک لایه‌ی تیره‌ی خنثی
 * دارد تا متن همیشه خوانا بماند. هاور: عکس داخل قاب ثابت کمی بزرگ می‌شود و دکمه‌ی فلش بالا می‌آید.
 */
export function CommunityMosaic({
  communities,
  totalCommunities,
}: {
  communities: HomeCommunity[];
  totalCommunities: number;
}) {
  if (communities.length === 0) return null;
  const shown = communities.slice(0, MOSAIC.length);
  return (
    <section aria-labelledby="areas-title" className="container-page py-14 md:py-20">
      <Reveal>
        <SectionHead
          id="areas-title"
          title="محله‌های پرآگهی"
          lead="میانگین قیمت از آگهی‌های فعال هر محله محاسبه شده است."
          href="/areas"
          linkLabel="همه‌ی محله‌ها"
        />
      </Reveal>

      <Reveal>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-12 lg:gap-5">
          {shown.map((area, i) => {
            const slot = MOSAIC[i]!;
            const showStats = slot.big;
            return (
              <li key={area.path} className={cn(i === 0 && 'col-span-2', slot.span)}>
                <Link
                  href={`/search?location=${encodeURIComponent(area.path)}`}
                  prefetch={false}
                  className={cn(
                    'group relative isolate flex h-full flex-col justify-between overflow-hidden rounded-sm bg-brand-active p-4 text-white outline-offset-4 md:p-6',
                    i === 0 ? 'min-h-[18rem]' : 'min-h-[13rem]',
                    slot.height,
                  )}
                >
                  <MediaImage
                    variants={area.cover?.variants}
                    blurhash={area.cover?.blurhash}
                    width={area.cover?.width}
                    height={area.cover?.height}
                    alt={`نمایی از ${area.nameFa}`}
                    sizes={
                      i < 2 ? '(min-width: 1024px) 55vw, 100vw' : '(min-width: 1024px) 33vw, 50vw'
                    }
                    className="absolute inset-0 -z-20 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 -z-10 h-28 bg-[linear-gradient(to_bottom,rgb(14_16_20/0.5),rgb(14_16_20/0))]"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 -z-10 h-[78%] bg-[linear-gradient(to_top,rgb(14_16_20/0.88),rgb(14_16_20/0.5)_45%,rgb(14_16_20/0))]"
                  />

                  <div className="flex items-start justify-between gap-3">
                    <span className="font-sans text-xs tracking-widest text-white/80">
                      {toPersianDigits(String(i + 1).padStart(2, '0'))}
                    </span>
                    <span className="rounded-full bg-ink/75 px-3 py-1 text-xs text-white">
                      {formatNumber(area.listingCount, 0)} آگهی
                    </span>
                  </div>

                  <div>
                    <h3
                      className={cn(
                        'font-display font-bold leading-tight text-white',
                        slot.big ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl',
                      )}
                    >
                      {area.nameFa}
                    </h3>
                    <p className="mt-1 text-sm text-white/75">{area.nameEn}</p>

                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/30 pt-3">
                      <dl
                        className={cn(
                          'grid min-w-0 flex-1 grid-cols-2 gap-4',
                          !showStats && 'max-md:hidden',
                        )}
                      >
                        {area.avgSalePricePerSqft && (
                          <Stat
                            label="میانگین فروش"
                            value={formatPrice(area.avgSalePricePerSqft, { withCurrency: false })}
                            unit="درهم / فوت"
                          />
                        )}
                        {area.avgYearlyRent && (
                          <Stat
                            label="میانگین اجاره"
                            value={formatPrice(area.avgYearlyRent, { withCurrency: false })}
                            unit="درهم / سال"
                          />
                        )}
                      </dl>
                      <span
                        aria-hidden
                        className="ms-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-ink transition-[transform,background-color,color] duration-300 ease-out group-hover:-translate-y-1 group-hover:bg-accent group-hover:text-white"
                      >
                        <ArrowLeft size={18} />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {totalCommunities > shown.length && (
          <p className="mt-8 text-sm text-muted sm:hidden">
            <Link href="/areas" className="text-ink underline underline-offset-[6px]">
              مشاهده‌ی همه‌ی {formatNumber(totalCommunities, 0)} محله
            </Link>
          </p>
        )}
      </Reveal>
    </section>
  );
}
