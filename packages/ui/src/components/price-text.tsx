import { MARKET, RENT_PERIOD_LABEL, formatPrice, type RentPeriod } from '@ashian/shared';
import { cn } from '../lib/cn';

const sizes = {
  sm: { amount: 'text-base font-semibold', unit: 'text-xs' },
  md: { amount: 'text-xl font-bold', unit: 'text-sm' },
  lg: { amount: 'text-3xl font-bold', unit: 'text-base' },
  xl: { amount: 'text-5xl font-extrabold', unit: 'text-lg' },
} as const;

export interface PriceTextProps {
  amount: number;
  /** برای اجاره: «/ سال» */
  period?: RentPeriod;
  size?: keyof typeof sizes;
  /** قیمت خط‌خورده‌ی قبلی (تاریخچه‌ی کاهش قیمت) */
  previous?: number;
  className?: string;
}

/**
 * ممیز و جداکننده‌ی فارسی (٫ ٬) در فونت تیتر شکل کاما با فاصله‌ی زیاد می‌گیرند؛
 * این دو را با فونت متن رندر می‌کنیم تا عددهای درشت تمیز بمانند.
 */
function DisplayNumber({ text }: { text: string }) {
  return (
    <>
      {text.split(/([٫٬])/).map((part, i) =>
        part === '٫' || part === '٬' ? (
          <span key={i} className="mx-[-0.06em] font-sans font-normal">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * قیمت خوانا: عدد درشت و ارز ریز، مثل نشریه‌های اقتصادی.
 * فقط یک ارز نمایش داده می‌شود (درد Property Finder که سه ارز هم‌زمان نشان می‌داد).
 */
export function PriceText({ amount, period, size = 'md', previous, className }: PriceTextProps) {
  const s = sizes[size];
  const number = formatPrice(amount, { withCurrency: false });
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5 text-ink', className)}>
      <span className={cn('font-display tracking-tight proportional-nums', s.amount)}>
        <DisplayNumber text={number} />
      </span>
      <span className={cn('text-muted', s.unit)}>{MARKET.currency.label}</span>
      {period && <span className={cn('text-muted', s.unit)}>/ {RENT_PERIOD_LABEL[period]}</span>}
      {previous !== undefined && previous !== amount && (
        <del className={cn('text-faint', s.unit)}>
          <span className="sr-only">قیمت قبلی: </span>
          {formatPrice(previous, { withCurrency: false })}
        </del>
      )}
    </span>
  );
}
