import { MARKET, type AreaUnit } from './market.js';
import { formatNumber } from './numbers.js';

export const SQFT_PER_SQM = 10.763_910_416_7;

export const AREA_UNIT_LABEL: Record<AreaUnit, string> = {
  sqft: 'فوت مربع',
  sqm: 'متر مربع',
};

export function sqftToSqm(sqft: number): number {
  return sqft / SQFT_PER_SQM;
}

export function sqmToSqft(sqm: number): number {
  return sqm * SQFT_PER_SQM;
}

/** مقدار ذخیره‌شده را به واحد دلخواه تبدیل می‌کند */
export function convertArea(value: number, to: AreaUnit, from: AreaUnit = MARKET.storageAreaUnit) {
  if (from === to) return value;
  return to === 'sqm' ? sqftToSqm(value) : sqmToSqft(value);
}

/** «۱٬۲۰۰ فوت مربع» */
export function formatArea(value: number, unit: AreaUnit = MARKET.displayAreaUnit): string {
  return `${formatNumber(Math.round(convertArea(value, unit)), 0)} ${AREA_UNIT_LABEL[unit]}`;
}
