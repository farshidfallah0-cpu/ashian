/**
 * کار با query string جستجو، بدون هیچ وابستگی (حتی zod): هم در سرور و هم در کلاینت استفاده می‌شود.
 * اعتبارسنجی واقعی فقط در سرور و در API انجام می‌شود؛ کلاینت فقط رشته‌ها را می‌سازد.
 */

export type QsValue = string | number | boolean | readonly (string | number)[] | null | undefined;

/** مقدار پیش‌فرضی که در URL نوشته نمی‌شود تا لینک‌ها کوتاه و یکتا بمانند */
const DEFAULTS: Record<string, string> = { sort: 'relevance', page: '1', pageSize: '20' };

/** پارامترهایی که به «فیلتر» حساب می‌شوند (برای شمارنده‌ی فیلترهای فعال) */
export const FILTER_KEYS = [
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
  'agentId',
  'cheques',
  'parkingMin',
  'postedWithin',
  'q',
  'bbox',
] as const;

const isEmpty = (value: QsValue): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  value === false ||
  (Array.isArray(value) && value.length === 0);

/**
 * اعمال تغییر روی query string.
 * null / undefined / false / رشته‌ی خالی = حذف. آرایه با ویرگول به‌هم می‌چسبد. با هر تغییر فیلتر صفحه به ۱ برمی‌گردد
 * (مگر خود `page` در patch باشد).
 */
export function withPatch(qs: string, patch: Record<string, QsValue>): string {
  const params = new URLSearchParams(qs);
  for (const [key, value] of Object.entries(patch)) {
    if (isEmpty(value) || String(value) === DEFAULTS[key]) params.delete(key);
    else if (Array.isArray(value)) params.set(key, value.join(','));
    else params.set(key, value === true ? '1' : String(value));
  }
  if (!('page' in patch)) params.delete('page');
  // ترتیب ثابت: کلیدها الفبایی، تا لینک و کش یکتا باشند
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return sorted.toString();
}

export const hrefOf = (path: string, qs: string): string => (qs ? `${path}?${qs}` : path);

/** مقدارهای یک پارامتر لیستی («a,b») */
export function listOf(qs: string, key: string): string[] {
  const raw = new URLSearchParams(qs).get(key);
  return raw ? raw.split(',').filter(Boolean) : [];
}

export function numberOf(qs: string, key: string): number | undefined {
  const raw = new URLSearchParams(qs).get(key);
  if (raw === null || raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** تعداد فیلترهای فعال؛ جفت min/max یک فیلتر حساب می‌شود و `q` و `bbox` هم یک فیلتر است */
export function countActiveFilters(qs: string): number {
  const params = new URLSearchParams(qs);
  const groups: string[][] = [
    ['dealType'],
    ['propertyType'],
    ['location'],
    ['priceMin', 'priceMax'],
    ['bedroomsMin', 'bedroomsMax'],
    ['bathroomsMin'],
    ['areaMin', 'areaMax'],
    ['furnishing'],
    ['amenities'],
    ['verified'],
    ['agentId'],
    ['cheques'],
    ['parkingMin'],
    ['postedWithin'],
    ['q'],
    ['bbox'],
  ];
  return groups.filter((keys) => keys.some((k) => params.get(k))).length;
}

/** فقط پارامترهای فیلتر (بدون sort، page، view …)؛ ورودی endpoint نقشه و شمارنده */
export function filtersOnly(qs: string, extraDrop: string[] = []): string {
  const params = new URLSearchParams(qs);
  const keep = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (extraDrop.includes(key)) continue;
    const value = params.get(key);
    if (value) keep.set(key, value);
  }
  if (params.get('verifiedFirst')) keep.set('verifiedFirst', params.get('verifiedFirst')!);
  return keep.toString();
}
