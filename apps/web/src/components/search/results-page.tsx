import { cn, getPageRange } from '@ashian/ui';
import { formatNumber, formatPrice, type SearchFacets, type SearchResponse } from '@ashian/shared';
import { ArrowLeft, ArrowRight, Columns, List, MapTrifold, X } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import {
  buildChips,
  buildHeading,
  fetchSearch,
  getAmenities,
  getPlaces,
  type ParsedSearch,
  type PlaceInfo,
  type ViewMode,
} from '../../lib/search-server';
import { filtersOnly, hrefOf, withPatch } from '../../lib/search-url';
import type { AmenityOption, CommunityOption } from './filters-dialog';
import { FilterBar } from './filter-bar';
import { ResultCard } from './result-card';
import { ResultsBody } from './results-body';
import { ResultsShell } from './results-shell';
import { Toolbar } from './toolbar';

/** تعداد فیلتر ثابت لندینگ: این کلیدها در لینک‌های همان صفحه تکرار نمی‌شوند (مسیر خودش آن‌ها را می‌گوید) */
export type LandingPreset = Record<string, string>;

export interface ResultsPageProps {
  parsed: ParsedSearch;
  /** مسیر صفحه: «/search» یا مسیر لندینگ مثل «/rent/apartment/dubai-marina» */
  basePath: string;
  /** فیلترهایی که مسیر لندینگ خودش بیان می‌کند */
  preset?: LandingPreset;
  /** محتوای متنی صفحه‌ی لندینگ (توضیح یکتا و لینک‌های داخلی)؛ بعد از دریافت داده ساخته می‌شود */
  seo?: (context: {
    data: SearchResponse;
    places: PlaceInfo[];
    heading: string;
  }) => React.ReactNode;
  headingOverride?: string;
}

export function communityOptions(
  places: PlaceInfo[],
  facets: SearchFacets | null,
): CommunityOption[] {
  const communities = places.filter((p) => p.type === 'community');
  if (!facets)
    return communities.map((p) => ({ path: p.path, nameFa: p.nameFa, count: p.listingCount }));
  return facets.community.flatMap((o) => {
    const place = communities.find((p) => p.slug === o.value);
    return place ? [{ path: place.path, nameFa: place.nameFa, count: o.count }] : [];
  });
}

const VIEW_ICONS = {
  list: <List size={16} aria-hidden />,
  split: <Columns size={16} aria-hidden />,
  map: <MapTrifold size={16} aria-hidden />,
};

function ViewSwitch({ view, qs, basePath }: { view: ViewMode; qs: string; basePath: string }) {
  const items: Array<['list' | 'split' | 'map', string]> = [
    ['list', 'لیست'],
    ['split', 'ترکیبی'],
    ['map', 'نقشه'],
  ];
  const current = view === 'auto' ? 'split' : view;
  return (
    <nav aria-label="نحوه‌ی نمایش" className="hidden xl:block">
      <ul className="inline-flex overflow-hidden rounded-sm border border-line-strong">
        {items.map(([value, label], i) => (
          <li key={value} className={i > 0 ? 'border-s border-line-strong' : ''}>
            <Link
              href={hrefOf(
                basePath,
                withPatch(qs, { view: value === 'split' ? null : value, page: 1 }),
              )}
              prefetch={false}
              aria-current={current === value ? 'true' : undefined}
              className={cn(
                'inline-flex h-10 items-center gap-2 px-3.5 text-sm transition-colors duration-150',
                current === value ? 'bg-brand text-white' : 'bg-bg text-ink hover:bg-surface',
              )}
            >
              {VIEW_ICONS[value]}
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Pagination({
  page,
  totalPages,
  qs,
  basePath,
}: {
  page: number;
  totalPages: number;
  qs: string;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => hrefOf(basePath, withPatch(qs, { page: p }));
  const item =
    'inline-flex size-10 items-center justify-center rounded-sm border text-sm transition-colors duration-150';
  return (
    <nav aria-label="صفحه‌بندی" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          rel="prev"
          prefetch={false}
          aria-label="صفحه‌ی قبل"
          className={cn(item, 'border-line-strong hover:border-ink')}
        >
          <ArrowRight size={16} aria-hidden />
        </Link>
      )}
      {getPageRange(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            prefetch={false}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`صفحه‌ی ${formatNumber(p, 0)}`}
            className={cn(
              item,
              p === page
                ? 'border-brand bg-brand text-white'
                : 'border-line-strong hover:border-ink',
            )}
          >
            {formatNumber(p, 0)}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link
          href={href(page + 1)}
          rel="next"
          prefetch={false}
          aria-label="صفحه‌ی بعد"
          className={cn(item, 'border-line-strong hover:border-ink')}
        >
          <ArrowLeft size={16} aria-hidden />
        </Link>
      )}
    </nav>
  );
}

/**
 * صفحه‌ی نتایج (سرور): هم /search و هم لندینگ‌های سئو از همین استفاده می‌کنند.
 * همه‌ی فیلترها در URL‌اند؛ چیپ‌ها، صفحه‌بندی و نمای لیست/نقشه لینک واقعی‌اند (بدون JavaScript هم کار می‌کنند).
 */
export async function ResultsPage({
  parsed,
  basePath,
  preset = {},
  seo,
  headingOverride,
}: ResultsPageProps) {
  const { query, qs, apiQs, view } = parsed;
  const [data, places, amenityList] = await Promise.all([
    fetchSearch(apiQs),
    getPlaces(),
    getAmenities(),
  ]);

  const heading = headingOverride ?? buildHeading(query, places);
  const amenityName = new Map(amenityList.map((a) => [a.slug, a.nameFa]));
  const chips = buildChips(query, qs, places).map((c) => ({
    ...c,
    label: c.id.startsWith('am:') ? (amenityName.get(c.id.slice(3)) ?? c.label) : c.label,
  }));

  // لینک‌های همان صفحه نباید فیلترهای ثابت لندینگ را تکرار کنند
  const linkQs = (value: string) => {
    const params = new URLSearchParams(value);
    for (const key of Object.keys(preset)) params.delete(key);
    return params.toString();
  };

  if (!data) return <ResultsUnavailable />;

  const items = data.items;
  const initialPoints = items.map(
    (i) => [i.coordinates.lng, i.coordinates.lat] as [number, number],
  );
  const amenities: AmenityOption[] = amenityList.map((a) => ({ slug: a.slug, nameFa: a.nameFa }));

  return (
    <ResultsShell qs={qs} view={view}>
      <FilterBar
        facets={data.facets}
        communities={communityOptions(places, data.facets)}
        amenities={amenities}
      />

      <div className="container-page pb-4 pt-7 group-data-[view=map]/shell:max-xl:hidden">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="text-2xl md:text-3xl">{heading}</h1>
            <p className="mt-1.5 text-base text-muted" aria-live="polite">
              {data.total === 0
                ? 'آگهی‌ای با این فیلترها پیدا نشد'
                : `${formatNumber(data.total, 0)} آگهی${
                    data.facets?.price
                      ? `، از ${formatPrice(data.facets.price.min)} تا ${formatPrice(data.facets.price.max)}`
                      : ''
                  }`}
            </p>
          </div>
          <ViewSwitch view={view} qs={linkQs(qs)} basePath={basePath} />
        </div>

        <div className="mt-5">
          <Toolbar heading={heading} />
        </div>

        {chips.length > 0 && (
          <ul className="mt-5 flex flex-wrap items-center gap-2" aria-label="فیلترهای فعال">
            {chips.map((chip) => (
              <li key={chip.id}>
                <Link
                  href={hrefOf('/search', chip.removeQs)}
                  prefetch={false}
                  aria-label={`حذف فیلتر ${chip.label}`}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface ps-4 pe-3 text-sm text-ink transition-colors duration-150 hover:border-ink"
                >
                  {chip.label}
                  <X size={13} weight="bold" aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={hrefOf('/search', withPatch('', { view: view === 'auto' ? null : view }))}
                prefetch={false}
                className="px-2 text-sm text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
              >
                پاک کردن همه
              </Link>
            </li>
          </ul>
        )}
      </div>

      <div className="container-page pb-16 pt-4">
        <ResultsBody
          mapQs={filtersOnly(apiQs, ['bbox'])}
          initialPoints={initialPoints}
          icons={{
            map: <MapTrifold size={18} aria-hidden />,
            list: <List size={18} aria-hidden />,
          }}
          list={<ResultList data={data} qs={linkQs(qs)} basePath={basePath} chips={chips} />}
        />
        {seo?.({ data, places, heading })}
      </div>
      <script
        type="application/ld+json"
        // ItemList برای موتورهای جستجو: نام و آدرس آگهی‌های همین صفحه
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: heading,
            numberOfItems: data.total,
            itemListElement: items.map((item, i) => ({
              '@type': 'ListItem',
              position: (data.page - 1) * data.pageSize + i + 1,
              url: `/listings/${item.publicId}`,
              name: item.title,
            })),
          }).replace(/</g, '\\u003c'),
        }}
      />
    </ResultsShell>
  );
}

function ResultList({
  data,
  qs,
  basePath,
  chips,
}: {
  data: SearchResponse;
  qs: string;
  basePath: string;
  chips: Array<{ id: string; label: string; removeQs: string }>;
}) {
  if (data.items.length === 0) return <EmptyResults chips={chips} />;
  return (
    <>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 group-data-[view=list]/shell:xl:grid-cols-3">
        {data.items.map((listing, index) => (
          <li key={listing.publicId}>
            <ResultCard listing={listing} index={index} priority={index < 2} />
          </li>
        ))}
      </ul>
      <Pagination page={data.page} totalPages={data.totalPages} qs={qs} basePath={basePath} />
    </>
  );
}

/** حالت خالی با پیشنهاد کم کردن فیلتر؛ هر پیشنهاد لینک حذف همان فیلتر است */
function EmptyResults({
  chips,
}: {
  chips: Array<{ id: string; label: string; removeQs: string }>;
}) {
  return (
    <div className="rounded-sm border border-dashed border-line-strong px-6 py-14 text-center">
      <h2 className="font-display text-xl text-ink">نتیجه‌ای پیدا نشد</h2>
      <p className="mx-auto mt-2 max-w-md text-base text-muted">
        فیلترها را کمی باز کنید. با حذف هر کدام از موارد زیر، نتایج بیشتری می‌بینید.
      </p>
      {chips.length > 0 && (
        <ul className="mt-6 flex flex-wrap justify-center gap-2.5">
          {chips.slice(0, 6).map((chip) => (
            <li key={chip.id}>
              <Link
                href={hrefOf('/search', chip.removeQs)}
                prefetch={false}
                className="inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong px-4 text-sm text-ink hover:border-ink hover:bg-surface"
              >
                حذف «{chip.label}»
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/search"
        prefetch={false}
        className="mt-6 inline-block text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
      >
        دیدن همه‌ی آگهی‌ها
      </Link>
    </div>
  );
}

function ResultsUnavailable() {
  return (
    <div className="container-page py-24 text-center">
      <h1 className="text-2xl">جستجو موقتاً در دسترس نیست</h1>
      <p className="mt-3 text-base text-muted">چند لحظه‌ی دیگر دوباره تلاش کنید.</p>
    </div>
  );
}
