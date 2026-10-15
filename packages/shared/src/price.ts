import { MARKET, RENT_PERIOD_LABEL, type RentPeriod } from './market.js';
import { formatNumber } from './numbers.js';

export interface FormatPriceOptions {
  /** خوانا با مقیاس («۱۲۰ هزار») یا کامل («۱۲۰٬۰۰۰») */
  compact?: boolean;
  /** نمایش برچسب ارز */
  withCurrency?: boolean;
}

/**
 * قیمت را خوانا نمایش می‌دهد.
 *   120000   → «۱۲۰ هزار درهم»
 *   1250000  → «۱٫۲۵ میلیون درهم»
 *   950      → «۹۵۰ درهم»
 */
export function formatPrice(amount: number, options: FormatPriceOptions = {}): string {
  const { compact = true, withCurrency = true } = options;
  const suffix = withCurrency ? ` ${MARKET.currency.label}` : '';

  if (compact) {
    const scale = MARKET.currency.scales.find((s) => Math.abs(amount) >= s.value);
    if (scale) {
      const scaled = amount / scale.value;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      const rounded = Math.round(scaled * 10 ** digits) / 10 ** digits;
      return `${formatNumber(rounded, digits)} ${scale.label}${suffix}`;
    }
  }
  return `${formatNumber(Math.round(amount), 0)}${suffix}`;
}

/** قیمت اجاره با دوره: «۱۲۰ هزار درهم / سال» */
export function formatRent(
  amount: number,
  period: RentPeriod = MARKET.rent.defaultPeriod,
  options?: FormatPriceOptions,
): string {
  return `${formatPrice(amount, options)} / ${RENT_PERIOD_LABEL[period]}`;
}

/** تعداد چک: «۴ چک»؛ یک چک = «یک‌جا» */
export function formatCheques(count: number): string {
  return count === 1 ? 'یک‌جا' : `${formatNumber(count, 0)} چک`;
}
