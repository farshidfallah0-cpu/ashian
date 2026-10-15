'use client';

import { formatPrice, toEnglishDigits } from '@ashian/shared';
import { useMemo, useState } from 'react';

const STEPS = 1000;

export interface PriceHistogram {
  edges: number[];
  counts: number[];
}

/** گرد کردن «قشنگ» قیمت بر اساس بزرگی آن */
function nice(value: number): number {
  const step =
    value < 1_000
      ? 10
      : value < 10_000
        ? 100
        : value < 100_000
          ? 1_000
          : value < 1_000_000
            ? 5_000
            : value < 10_000_000
              ? 50_000
              : 250_000;
  return Math.max(step, Math.round(value / step) * step);
}

const parseAmount = (text: string): number | undefined => {
  const digits = toEnglishDigits(text).replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
};

/**
 * فیلتر قیمت: هیستوگرام توزیع + اسلایدر دوسر (مقیاس لگاریتمی، هم‌راستا با ستون‌های هیستوگرام) + دو فیلد عددی.
 * ستون‌های داخل بازه‌ی انتخابی پررنگ‌اند. بعد از رها کردن دستگیره یا زدن Enter اعمال می‌شود.
 * بدون Radix: دو input[type=range] روی هم (استایل در globals.css).
 * وضعیت داخلی فقط از props اولیه ساخته می‌شود؛ هر کس این را render می‌کند key={min-max} بدهد تا با تغییر فیلتر از بیرون دوباره ساخته شود.
 */
export function PriceFilter({
  histogram,
  min,
  max,
  onApply,
}: {
  histogram: PriceHistogram | null;
  min: number | undefined;
  max: number | undefined;
  onApply: (min: number | undefined, max: number | undefined) => void;
}) {
  const lo = histogram?.edges[0] ?? 0;
  const hi = histogram ? histogram.edges[histogram.edges.length - 1]! - 1 : 0;
  const ratio = hi > lo && lo > 0 ? Math.log(hi / lo) : 0;

  const toT = (price: number) =>
    ratio ? Math.round((Math.log(Math.max(price, lo) / lo) / ratio) * STEPS) : 0;
  const toPrice = (t: number) => (ratio ? nice(lo * Math.exp((ratio * t) / STEPS)) : 0);

  const [tMin, setTMin] = useState(min === undefined ? 0 : toT(min));
  const [tMax, setTMax] = useState(max === undefined ? STEPS : toT(max));
  const [minText, setMinText] = useState(min === undefined ? '' : String(min));
  const [maxText, setMaxText] = useState(max === undefined ? '' : String(max));

  const peak = useMemo(() => Math.max(1, ...(histogram?.counts ?? [1])), [histogram]);
  const buckets = histogram?.counts.length ?? 0;

  const commit = (nextMin: number | undefined, nextMax: number | undefined) => {
    const a = nextMin !== undefined && nextMin > lo ? nextMin : undefined;
    const b = nextMax !== undefined && nextMax < hi ? nextMax : undefined;
    onApply(a, b);
  };

  const commitSlider = () =>
    commit(tMin <= 0 ? undefined : toPrice(tMin), tMax >= STEPS ? undefined : toPrice(tMax));

  return (
    <div className="w-[min(22rem,calc(100vw-3rem))]" dir="rtl">
      {histogram && ratio > 0 && (
        <>
          <div className="flex h-14 items-end gap-px" aria-hidden>
            {histogram.counts.map((count, i) => {
              const from = (i / buckets) * STEPS;
              const to = ((i + 1) / buckets) * STEPS;
              const inside = to > tMin && from < tMax;
              return (
                <span
                  key={i}
                  style={{ height: `${Math.max(6, (count / peak) * 100)}%` }}
                  className={`flex-1 rounded-t-[1px] ${inside ? 'bg-brand' : 'bg-line-strong'}`}
                />
              );
            })}
          </div>
          <div className="relative mt-1 h-6">
            <span
              className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-line-strong"
              aria-hidden
            />
            <span
              aria-hidden
              style={{
                insetInlineStart: `${(tMin / STEPS) * 100}%`,
                insetInlineEnd: `${100 - (tMax / STEPS) * 100}%`,
              }}
              className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-brand"
            />
            <input
              type="range"
              className="price-range"
              min={0}
              max={STEPS}
              value={tMin}
              aria-label="حداقل قیمت"
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), tMax - 10);
                setTMin(v);
                setMinText(v <= 0 ? '' : String(toPrice(v)));
              }}
              onPointerUp={commitSlider}
              onKeyUp={commitSlider}
            />
            <input
              type="range"
              className="price-range"
              min={0}
              max={STEPS}
              value={tMax}
              aria-label="حداکثر قیمت"
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), tMin + 10);
                setTMax(v);
                setMaxText(v >= STEPS ? '' : String(toPrice(v)));
              }}
              onPointerUp={commitSlider}
              onKeyUp={commitSlider}
            />
          </div>
          <p className="mt-2 flex justify-between text-xs text-muted">
            <span>{formatPrice(tMin <= 0 ? lo : toPrice(tMin))}</span>
            <span>{formatPrice(tMax >= STEPS ? hi : toPrice(tMax))}</span>
          </p>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {(
          [
            ['از', minText, setMinText, 'حداقل قیمت (درهم)'],
            ['تا', maxText, setMaxText, 'حداکثر قیمت (درهم)'],
          ] as const
        ).map(([label, value, set, aria]) => (
          <label key={aria} className="flex flex-col gap-1 text-xs text-muted">
            {label}
            <input
              inputMode="numeric"
              value={value}
              placeholder="درهم"
              aria-label={aria}
              onChange={(e) => set(e.target.value)}
              onBlur={() => commit(parseAmount(minText), parseAmount(maxText))}
              onKeyDown={(e) =>
                e.key === 'Enter' && commit(parseAmount(minText), parseAmount(maxText))
              }
              className="h-10 rounded-sm border border-line-strong bg-bg px-3 text-base text-ink focus-visible:border-brand focus-visible:outline-none"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
