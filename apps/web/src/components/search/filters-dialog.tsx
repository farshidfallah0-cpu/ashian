'use client';

import {
  LABELS,
  PROPERTY_TYPES,
  formatNumber,
  type SearchFacets,
  type FacetOption,
} from '@ashian/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { countActiveFilters, listOf, numberOf, withPatch } from '../../lib/search-url';
import { ChoiceChip } from './popover';
import { PriceFilter } from './price-filter';
import { useResults } from './results-shell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface CommunityOption {
  path: string;
  nameFa: string;
  count: number;
}
export interface AmenityOption {
  slug: string;
  nameFa: string;
}

const FURNISHING = ['furnished', 'semi_furnished', 'unfurnished'] as const;
const DEALS = ['rent', 'sale', 'full_mortgage', 'short_term'] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-5 last:border-b-0">
      <h3 className="mb-3 font-sans text-base font-bold text-ink">{title}</h3>
      {children}
    </section>
  );
}

const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * پنل «فیلترهای بیشتر»: در موبایل Bottom Sheet و در دسکتاپ پنل کناری (با عنصر بومی <dialog>:
 * focus trap و Escape را خود مرورگر انجام می‌دهد). تغییرها «پیش‌نویس»اند و فقط با دکمه‌ی پایین
 * اعمال می‌شوند؛ تعداد نتایج پیش‌نویس همان‌جا و قبل از اعمال نشان داده می‌شود.
 */
export function FiltersDialog({
  open,
  onClose,
  facets,
  communities,
  amenities,
}: {
  open: boolean;
  onClose: () => void;
  facets: SearchFacets | null;
  communities: CommunityOption[];
  amenities: AmenityOption[];
}) {
  const { qs, go } = useResults();
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(qs);
  const [count, setCount] = useState<number | null>(null);

  // باز شدن: پیش‌نویس از URL فعلی شروع می‌شود
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setDraft(qs);
      setCount(null);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open, qs]);

  // شمارش زنده‌ی پیش‌نویس (debounce)؛ فقط total لازم است، پس pageSize=1 و بدون facet
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams(withPatch(draft, { view: null, page: null, sort: null }));
      params.set('pageSize', '1');
      params.set('facets', '0');
      try {
        const response = await fetch(`${API}/v1/search/listings?${params}`, {
          signal: controller.signal,
        });
        if (response.ok) setCount(((await response.json()) as { total: number }).total);
      } catch {
        /* لغو یا شبکه */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, open]);

  const patch = (changes: Record<string, string | string[] | number | boolean | null>) =>
    setDraft((d) => withPatch(d, changes));

  const deals = listOf(draft, 'dealType');
  const types = listOf(draft, 'propertyType');
  const locations = listOf(draft, 'location');
  const furnishing = listOf(draft, 'furnishing');
  const picked = listOf(draft, 'amenities');
  const bedsMin = numberOf(draft, 'bedroomsMin');
  const bedsMax = numberOf(draft, 'bedroomsMax');
  const isRent = deals.length === 0 || deals.includes('rent');
  const activeCount = countActiveFilters(draft);

  const countOf = (options: FacetOption[] | undefined, value: string) =>
    options?.find((o) => o.value === value)?.count;

  const sortedCommunities = useMemo(
    () => [...communities].sort((a, b) => b.count - a.count).slice(0, 40),
    [communities],
  );

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
      aria-label="فیلترهای بیشتر"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-lg bg-bg p-0 text-ink backdrop:bg-overlay md:inset-y-0 md:start-0 md:end-auto md:top-0 md:max-h-none md:w-[30rem] md:rounded-none"
    >
      <form
        method="dialog"
        className="flex max-h-[92dvh] flex-col md:h-dvh md:max-h-none"
        onSubmit={(event) => {
          event.preventDefault();
          go(draft);
          onClose();
        }}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-xl">فیلترها</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex size-9 items-center justify-center rounded-sm text-ink hover:bg-surface"
          >
            <svg
              viewBox="0 0 16 16"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="m3 3 10 10M13 3 3 13" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          <Section title="نوع معامله">
            <div className="flex flex-wrap gap-2">
              {DEALS.map((deal) => (
                <ChoiceChip
                  key={deal}
                  selected={deals.includes(deal)}
                  onClick={() => patch({ dealType: toggle(deals, deal) })}
                >
                  {LABELS.dealType[deal]}
                </ChoiceChip>
              ))}
            </div>
          </Section>

          <Section title="نوع ملک">
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((type) => (
                <ChoiceChip
                  key={type}
                  selected={types.includes(type)}
                  onClick={() => patch({ propertyType: toggle(types, type) })}
                >
                  {LABELS.propertyType[type]}
                  {countOf(facets?.propertyType, type) !== undefined && (
                    <span className="ms-1.5 text-xs opacity-70">
                      {formatNumber(countOf(facets?.propertyType, type)!, 0)}
                    </span>
                  )}
                </ChoiceChip>
              ))}
            </div>
          </Section>

          <Section title="قیمت (درهم)">
            <PriceFilter
              key={`${numberOf(draft, 'priceMin') ?? ''}-${numberOf(draft, 'priceMax') ?? ''}`}
              histogram={facets?.priceHistogram ?? null}
              min={numberOf(draft, 'priceMin')}
              max={numberOf(draft, 'priceMax')}
              onApply={(min, max) => patch({ priceMin: min ?? null, priceMax: max ?? null })}
            />
          </Section>

          <Section title="تعداد خواب">
            <div className="flex flex-wrap gap-2">
              <ChoiceChip
                selected={bedsMin === undefined && bedsMax === undefined}
                onClick={() => patch({ bedroomsMin: null, bedroomsMax: null })}
              >
                همه
              </ChoiceChip>
              {[0, 1, 2, 3, 4].map((n) => (
                <ChoiceChip
                  key={n}
                  selected={bedsMin === n && bedsMax === n}
                  onClick={() => patch({ bedroomsMin: n, bedroomsMax: n })}
                >
                  {n === 0 ? 'استودیو' : formatNumber(n, 0)}
                </ChoiceChip>
              ))}
              <ChoiceChip
                selected={bedsMin === 5 && bedsMax === undefined}
                onClick={() => patch({ bedroomsMin: 5, bedroomsMax: null })}
              >
                +۵
              </ChoiceChip>
            </div>
            <h4 className="mb-2 mt-4 text-sm text-muted">حداقل تعداد حمام</h4>
            <div className="flex flex-wrap gap-2">
              {[null, 1, 2, 3, 4].map((n) => (
                <ChoiceChip
                  key={String(n)}
                  selected={numberOf(draft, 'bathroomsMin') === (n ?? undefined)}
                  onClick={() => patch({ bathroomsMin: n })}
                >
                  {n === null ? 'همه' : `${formatNumber(n, 0)}+`}
                </ChoiceChip>
              ))}
            </div>
          </Section>

          {sortedCommunities.length > 0 && (
            <Section title="محله">
              <ul className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto pe-1">
                {sortedCommunities.map((c) => (
                  <li key={c.path}>
                    <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={locations.includes(c.path)}
                        onChange={() => patch({ location: toggle(locations, c.path) })}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                      <span className="truncate">{c.nameFa}</span>
                      <span className="ms-auto text-xs text-muted">{formatNumber(c.count, 0)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="متراژ (فوت مربع)">
            <div className="grid grid-cols-2 gap-3">
              {(['areaMin', 'areaMax'] as const).map((key) => (
                <label key={key} className="flex flex-col gap-1 text-xs text-muted">
                  {key === 'areaMin' ? 'از' : 'تا'}
                  <input
                    inputMode="numeric"
                    value={numberOf(draft, key) ?? ''}
                    placeholder="فوت"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, '');
                      patch({ [key]: digits || null });
                    }}
                    className="h-10 rounded-sm border border-line-strong bg-bg px-3 text-base text-ink focus-visible:border-brand focus-visible:outline-none"
                  />
                </label>
              ))}
            </div>
          </Section>

          <Section title="وضعیت مبلمان">
            <div className="flex flex-wrap gap-2">
              {FURNISHING.map((f) => (
                <ChoiceChip
                  key={f}
                  selected={furnishing.includes(f)}
                  onClick={() => patch({ furnishing: toggle(furnishing, f) })}
                >
                  {LABELS.furnishing[f]}
                </ChoiceChip>
              ))}
            </div>
          </Section>

          {amenities.length > 0 && (
            <Section title="امکانات">
              <div className="flex flex-wrap gap-2">
                {amenities
                  .filter(
                    (a) =>
                      countOf(facets?.amenities, a.slug) !== undefined || picked.includes(a.slug),
                  )
                  .map((a) => (
                    <ChoiceChip
                      key={a.slug}
                      selected={picked.includes(a.slug)}
                      onClick={() => patch({ amenities: toggle(picked, a.slug) })}
                    >
                      {a.nameFa}
                    </ChoiceChip>
                  ))}
              </div>
            </Section>
          )}

          {isRent && (
            <Section title="تعداد چک (اجاره)">
              <div className="flex flex-wrap gap-2">
                <ChoiceChip
                  selected={!numberOf(draft, 'cheques')}
                  onClick={() => patch({ cheques: null })}
                >
                  همه
                </ChoiceChip>
                {[1, 2, 4, 6, 12].map((n) => (
                  <ChoiceChip
                    key={n}
                    selected={numberOf(draft, 'cheques') === n}
                    onClick={() => patch({ cheques: n })}
                  >
                    {n === 1 ? 'یک‌جا' : formatNumber(n, 0)}
                  </ChoiceChip>
                ))}
              </div>
            </Section>
          )}

          <Section title="سایر">
            <div className="space-y-4">
              <label className="flex cursor-pointer items-center justify-between gap-4 text-base">
                فقط آگهی‌های تأییدشده
                <input
                  type="checkbox"
                  role="switch"
                  checked={new URLSearchParams(draft).get('verified') === '1'}
                  onChange={(e) => patch({ verified: e.target.checked })}
                  className="size-5 accent-[var(--color-verified)]"
                />
              </label>
              <label className="flex items-center justify-between gap-4 text-base">
                حداقل پارکینگ
                <select
                  value={numberOf(draft, 'parkingMin') ?? ''}
                  onChange={(e) => patch({ parkingMin: e.target.value || null })}
                  className="h-10 rounded-sm border border-line-strong bg-bg px-3 text-base"
                >
                  <option value="">مهم نیست</option>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {formatNumber(n, 0)}+
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between gap-4 text-base">
                زمان انتشار
                <select
                  value={numberOf(draft, 'postedWithin') ?? ''}
                  onChange={(e) => patch({ postedWithin: e.target.value || null })}
                  className="h-10 rounded-sm border border-line-strong bg-bg px-3 text-base"
                >
                  <option value="">هر زمان</option>
                  {[1, 3, 7, 14, 30].map((n) => (
                    <option key={n} value={n}>
                      {formatNumber(n, 0)} روز اخیر
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Section>
        </div>

        <footer className="flex items-center gap-3 border-t border-line bg-bg px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() =>
              patch(
                Object.fromEntries(
                  [
                    'dealType',
                    'propertyType',
                    'location',
                    'priceMin',
                    'priceMax',
                    'bedroomsMin',
                    'bedroomsMax',
                    'bathroomsMin',
                    'areaMin',
                    'areaMax',
                    'furnishing',
                    'amenities',
                    'verified',
                    'cheques',
                    'parkingMin',
                    'postedWithin',
                    'bbox',
                  ].map((k) => [k, null]),
                ),
              )
            }
            disabled={activeCount === 0}
            className="h-12 shrink-0 px-2 text-base text-ink underline decoration-line-strong underline-offset-[6px] disabled:opacity-40"
          >
            پاک کردن
          </button>
          <button
            type="submit"
            className="h-12 flex-1 rounded-sm bg-accent px-5 text-base font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            {count === null ? 'نمایش نتایج' : `نمایش ${formatNumber(count, 0)} آگهی`}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
