'use client';

import {
  LABELS,
  PROPERTY_TYPES,
  formatNumber,
  formatPrice,
  type SearchFacets,
} from '@ashian/shared';
import { useState } from 'react';
import { countActiveFilters, listOf, numberOf } from '../../lib/search-url';
import { FiltersDialog, type AmenityOption, type CommunityOption } from './filters-dialog';
import { ChoiceChip, Popover } from './popover';
import { PriceFilter } from './price-filter';
import { useResults } from './results-shell';

const DEALS = [
  ['rent', 'اجاره'],
  ['sale', 'خرید'],
] as const;

/**
 * نوار فیلتر چسبان: معامله، نوع ملک، اتاق، قیمت (با هیستوگرام) و «فیلترهای بیشتر» با شمارنده.
 * هر تغییر بلافاصله در URL می‌نشیند (قابل اشتراک و برگشت‌پذیر)؛ روی موبایل فقط معامله و دکمه‌ی فیلترها می‌ماند.
 */
export function FilterBar({
  facets,
  communities,
  amenities,
}: {
  facets: SearchFacets | null;
  communities: CommunityOption[];
  amenities: AmenityOption[];
}) {
  const { qs, navigate, pending } = useResults();
  const [moreOpen, setMoreOpen] = useState(false);

  const deal = listOf(qs, 'dealType');
  const types = listOf(qs, 'propertyType');
  const bedsMin = numberOf(qs, 'bedroomsMin');
  const bedsMax = numberOf(qs, 'bedroomsMax');
  const priceMin = numberOf(qs, 'priceMin');
  const priceMax = numberOf(qs, 'priceMax');
  const active = countActiveFilters(qs);

  const typeCount = (value: string) => facets?.propertyType.find((o) => o.value === value)?.count;
  const bedsLabel =
    bedsMin === undefined && bedsMax === undefined
      ? 'اتاق'
      : bedsMin === bedsMax
        ? bedsMin === 0
          ? 'استودیو'
          : `${formatNumber(bedsMin!, 0)} خواب`
        : `${formatNumber(bedsMin ?? 0, 0)}+ خواب`;
  const priceLabel =
    priceMin === undefined && priceMax === undefined
      ? 'قیمت'
      : priceMin !== undefined && priceMax !== undefined
        ? `${formatPrice(priceMin, { withCurrency: false })} تا ${formatPrice(priceMax, { withCurrency: false })}`
        : priceMin !== undefined
          ? `از ${formatPrice(priceMin, { withCurrency: false })}`
          : `تا ${formatPrice(priceMax!, { withCurrency: false })}`;

  return (
    <div
      className={`sticky top-[68px] z-30 border-b border-line bg-bg transition-opacity duration-150 ${
        pending ? 'opacity-90' : ''
      }`}
    >
      <div className="container-page flex items-center gap-2.5 py-3">
        {/* معامله */}
        <div
          role="group"
          aria-label="نوع معامله"
          className="inline-flex h-10 shrink-0 overflow-hidden rounded-sm border border-line-strong"
        >
          {DEALS.map(([value, label]) => {
            const selected = deal.length === 1 && deal[0] === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => navigate({ dealType: selected ? null : value })}
                className={`px-4 text-sm transition-colors duration-150 ${
                  selected ? 'bg-brand text-white' : 'bg-bg text-ink hover:bg-surface'
                } ${value === 'sale' ? 'border-s border-line-strong' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* فیلترهای سریع، فقط دسکتاپ */}
        <div className="hidden items-center gap-2.5 md:flex">
          <Popover
            label={
              types.length
                ? `${LABELS.propertyType[types[0] as 'villa']}${types.length > 1 ? ` +${formatNumber(types.length - 1, 0)}` : ''}`
                : 'نوع ملک'
            }
            active={types.length > 0}
          >
            {() => (
              <ul className="min-w-56 space-y-0.5">
                {PROPERTY_TYPES.map((type) => (
                  <li key={type}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={types.includes(type)}
                        onChange={() =>
                          navigate({
                            propertyType: types.includes(type)
                              ? types.filter((t) => t !== type)
                              : [...types, type],
                          })
                        }
                        className="size-4 accent-[var(--color-brand)]"
                      />
                      {LABELS.propertyType[type]}
                      {typeCount(type) !== undefined && (
                        <span className="ms-auto text-xs text-muted">
                          {formatNumber(typeCount(type)!, 0)}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Popover>

          <Popover label={bedsLabel} active={bedsMin !== undefined || bedsMax !== undefined}>
            {({ close }) => (
              <div className="flex max-w-72 flex-wrap gap-2">
                <ChoiceChip
                  selected={bedsMin === undefined && bedsMax === undefined}
                  onClick={() => {
                    navigate({ bedroomsMin: null, bedroomsMax: null });
                    close();
                  }}
                >
                  همه
                </ChoiceChip>
                {[0, 1, 2, 3, 4].map((n) => (
                  <ChoiceChip
                    key={n}
                    selected={bedsMin === n && bedsMax === n}
                    onClick={() => {
                      navigate({ bedroomsMin: n, bedroomsMax: n });
                      close();
                    }}
                  >
                    {n === 0 ? 'استودیو' : formatNumber(n, 0)}
                  </ChoiceChip>
                ))}
                <ChoiceChip
                  selected={bedsMin === 5 && bedsMax === undefined}
                  onClick={() => {
                    navigate({ bedroomsMin: 5, bedroomsMax: null });
                    close();
                  }}
                >
                  +۵
                </ChoiceChip>
              </div>
            )}
          </Popover>

          <Popover label={priceLabel} active={priceMin !== undefined || priceMax !== undefined}>
            {() => (
              <PriceFilter
                key={`${priceMin ?? ''}-${priceMax ?? ''}`}
                histogram={facets?.priceHistogram ?? null}
                min={priceMin}
                max={priceMax}
                onApply={(min, max) => navigate({ priceMin: min ?? null, priceMax: max ?? null })}
              />
            )}
          </Popover>
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="ms-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-sm border border-line-strong bg-bg px-4 text-sm text-ink transition-colors duration-150 hover:border-ink md:ms-0"
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
            <path d="M2 4h12M4 8h8M6 12h4" />
          </svg>
          فیلترها
          {active > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-accent font-sans text-xs font-bold text-white">
              {formatNumber(active, 0)}
            </span>
          )}
        </button>
      </div>

      <FiltersDialog
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        facets={facets}
        communities={communities}
        amenities={amenities}
      />
    </div>
  );
}
