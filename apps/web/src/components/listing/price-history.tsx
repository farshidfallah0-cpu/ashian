import {
  formatDate,
  formatNumber,
  formatPrice,
  type ListingDetail,
  type RentPeriod,
} from '@ashian/shared';
import { PRICE_PERIOD } from '../../lib/listing';

interface Point {
  price: number;
  time: number;
}

const PERIOD_LABEL: Partial<Record<RentPeriod, string>> = { yearly: 'سالانه', daily: 'هر شب' };

/** درصد تغییر با علامت: «−۸٪» / «+۵٪» */
function signedPercent(from: number, to: number): string {
  const percent = Math.round(((to - from) / from) * 100);
  if (percent === 0) return '۰٪';
  return `${percent > 0 ? '+' : '−'}${formatNumber(Math.abs(percent), 0)}٪`;
}

/**
 * نمودار پله‌ای تاریخچه‌ی قیمت، کاملاً سروری و بدون کتابخانه: خط با SVG (stroke ثابت)،
 * نقطه‌ها و برچسب‌ها با HTML تا متن در هر عرضی خوانا بماند. محور زمان راست‌به‌چپ است.
 */
export function PriceHistory({ listing }: { listing: ListingDetail }) {
  const history: Point[] = listing.priceHistory.map((h) => ({
    price: h.price,
    time: new Date(h.changedAt).getTime(),
  }));
  // قیمت فعلی همیشه آخرین نقطه است (اگر در تاریخچه ثبت نشده باشد)
  const last = history[history.length - 1];
  if (!last || last.price !== listing.price) {
    history.push({ price: listing.price, time: new Date(listing.updatedAt).getTime() });
  }

  const period = PRICE_PERIOD[listing.dealType];
  const periodText = period ? PERIOD_LABEL[period] : undefined;

  if (history.length < 2) {
    const since = listing.publishedAt ?? listing.createdAt;
    return (
      <p className="text-base text-ink-2">
        قیمت این آگهی از {formatDate(since, 'long')} تغییری نکرده است.
      </p>
    );
  }

  const first = history[0]!;
  const current = history[history.length - 1]!;
  const t0 = first.time;
  const tEnd = Math.max(current.time, t0 + 1);
  const prices = history.map((p) => p.price);
  let min = Math.min(...prices);
  let max = Math.max(...prices);
  if (min === max) {
    min *= 0.95;
    max *= 1.05;
  }
  const pad = (max - min) * 0.18;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  // مختصات درصدی: x از راست (قدیمی‌ترین) به چپ (جدیدترین)؛ y از بالا
  const xOf = (time: number) => ((time - t0) / (tEnd - t0)) * 100;
  const yOf = (price: number) => 100 - ((price - lo) / (hi - lo)) * 100;

  // نمودار پله‌ای: قیمت تا تغییر بعدی ثابت می‌ماند
  const path = history
    .map((p, i) => {
      const x = 100 - xOf(p.time);
      const y = yOf(p.price);
      if (i === 0) return `M ${x} ${y}`;
      const prev = history[i - 1]!;
      return `L ${x} ${yOf(prev.price)} L ${x} ${y}`;
    })
    .join(' ');
  const area = `${path} L 0 ${yOf(current.price)} L 0 100 L 100 100 Z`;

  const ticks = [hi - pad, (lo + hi) / 2, lo + pad].map((v) => ({
    value: v,
    y: yOf(v),
  }));
  const changes = history.slice(1).reverse();
  const total = signedPercent(first.price, current.price);

  return (
    <div>
      <p className="text-base text-ink-2">
        از اولین ثبت تا امروز، قیمت{' '}
        <span className="font-bold text-ink">{total}</span>{' '}
        {current.price < first.price ? 'کاهش' : current.price > first.price ? 'افزایش' : 'تغییر'} یافته
        است{periodText ? ` (قیمت ${periodText}، به درهم)` : ' (به درهم)'}.
      </p>

      <figure className="mt-6">
        <div className="grid grid-cols-[auto_1fr] gap-x-3">
          <div className="relative h-56 w-14 text-xs text-muted" aria-hidden>
            {ticks.map((tick) => (
              <span
                key={tick.y}
                className="absolute end-0 -translate-y-1/2 whitespace-nowrap font-sans"
                style={{ top: `${tick.y}%` }}
              >
                {formatPrice(tick.value, { withCurrency: false })}
              </span>
            ))}
          </div>

          <div className="relative h-56">
            {ticks.map((tick) => (
              <div
                key={tick.y}
                aria-hidden
                className="absolute inset-x-0 border-t border-dashed border-line"
                style={{ top: `${tick.y}%` }}
              />
            ))}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 size-full overflow-visible text-brand"
              role="img"
              aria-label={`نمودار تاریخچه‌ی قیمت؛ از ${formatPrice(first.price)} تا ${formatPrice(current.price)}`}
            >
              <path d={area} className="fill-brand-soft" />
              <path
                d={path}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
            {history.map((p, i) => (
              <span
                key={`${p.time}-${i}`}
                title={`${formatPrice(p.price)} · ${formatDate(p.time, 'long')}`}
                // راست‌چین: لبه‌ی راست نقطه روی x قرار می‌گیرد، پس برای مرکز‌کردن به راست جابه‌جا می‌شود
                className={`absolute size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg ${
                  i === history.length - 1 ? 'bg-accent' : 'bg-brand'
                }`}
                style={{ insetInlineStart: `${xOf(p.time)}%`, top: `${yOf(p.price)}%` }}
              />
            ))}
          </div>

          <span aria-hidden />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <time dateTime={new Date(first.time).toISOString()}>
              {formatDate(first.time, 'short')}
            </time>
            <time dateTime={new Date(current.time).toISOString()}>
              {formatDate(current.time, 'short')}
            </time>
          </div>
        </div>
        <figcaption className="sr-only">نمودار تغییرهای قیمت این آگهی در طول زمان</figcaption>
      </figure>

      <ol className="mt-6 divide-y divide-line border-y border-line">
        {changes.slice(0, 6).map((point, i) => {
          const before = history[history.length - 1 - i - 1]!;
          return (
            <li key={`${point.time}-${i}`} className="flex items-center justify-between gap-4 py-3 text-base">
              <time dateTime={new Date(point.time).toISOString()} className="text-muted">
                {formatDate(point.time, 'long')}
              </time>
              <span className="flex items-baseline gap-3">
                <span className="text-ink">{formatPrice(point.price)}</span>
                <span
                  className={`w-12 text-end text-sm ${point.price < before.price ? 'text-verified' : 'text-ink-2'}`}
                >
                  {signedPercent(before.price, point.price)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
