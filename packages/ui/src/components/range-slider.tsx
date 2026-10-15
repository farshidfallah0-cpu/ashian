'use client';

import { Slider } from 'radix-ui';
import { useMemo } from 'react';
import { cn } from '../lib/cn';

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  /** پس از رها کردن اسلایدر؛ برای درخواست جستجو (نه روی هر حرکت) */
  onValueCommit?: (value: [number, number]) => void;
  /** توزیع آگهی‌ها در بازه‌ها؛ هر عدد ارتفاع یک ستون */
  histogram?: number[];
  /** قالب نمایش برچسب‌ها، مثلاً formatPrice */
  format?: (value: number) => string;
  label?: string;
  className?: string;
}

/**
 * اسلایدر دوطرفه‌ی راست‌چین: کمینه سمت راست، بیشینه سمت چپ.
 * ستون‌های هیستوگرام داخل بازه‌ی انتخاب‌شده تیره و بیرونش کم‌رنگ می‌شوند.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  onValueCommit,
  histogram,
  format = (v) => String(v),
  label,
  className,
}: RangeSliderProps) {
  const [lo, hi] = value;
  const peak = useMemo(() => Math.max(1, ...(histogram ?? [1])), [histogram]);
  const span = max - min || 1;

  return (
    <div className={cn('w-full', className)}>
      {histogram && (
        <div className="flex h-14 items-end gap-[3px] px-2.5" aria-hidden="true">
          {histogram.map((count, i) => {
            const binStart = min + (span * i) / histogram.length;
            const binEnd = min + (span * (i + 1)) / histogram.length;
            const inside = binEnd > lo && binStart < hi;
            return (
              <span
                key={i}
                className={cn(
                  'flex-1 origin-bottom rounded-[1px] transition-colors duration-150',
                  inside ? 'bg-brand/80' : 'bg-line',
                )}
                style={{ height: `${Math.max(6, (count / peak) * 100)}%` }}
              />
            );
          })}
        </div>
      )}

      <Slider.Root
        dir="rtl"
        min={min}
        max={max}
        step={step}
        value={value}
        minStepsBetweenThumbs={1}
        onValueChange={(v) => onValueChange([v[0] ?? min, v[1] ?? max])}
        onValueCommit={(v) => onValueCommit?.([v[0] ?? min, v[1] ?? max])}
        aria-label={label}
        className="relative flex h-6 w-full touch-none select-none items-center"
      >
        <Slider.Track className="relative h-[3px] grow rounded-full bg-line-strong">
          <Slider.Range className="absolute h-full rounded-full bg-brand" />
        </Slider.Track>
        {(['حداقل', 'حداکثر'] as const).map((name) => (
          <Slider.Thumb
            key={name}
            aria-label={label ? `${label} (${name})` : name}
            className={cn(
              'block size-6 rounded-full border border-line-strong bg-white shadow-xs',
              'transition-[transform,border-color,box-shadow] duration-150 ease-out',
              'hover:border-brand active:scale-110',
              'focus-visible:outline-none focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_rgb(27_43_75/0.18)]',
            )}
          />
        ))}
      </Slider.Root>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-ink">{format(lo)}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span className="text-ink">{format(hi)}</span>
      </div>
    </div>
  );
}
