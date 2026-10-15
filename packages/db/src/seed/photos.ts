/**
 * عکس‌های واقعی دبی برای داده‌ی نمونه (توسعه).
 * همه CC0 یا Public Domain از Wikimedia Commons‌اند؛ منبع و نام عکاس هر فایل در
 * `packages/db/assets/photos/CREDITS.json` ثبت شده است. آگهی‌های واقعی عکس خودِ آگهی‌دهنده را دارند.
 *
 * عکس‌ها بر اساس محله‌ی آگهی انتخاب می‌شوند تا کارت «دبی مارینا» عکس مارینا داشته باشد، نه افق دیگری.
 * ترتیب این آرایه با اندیس placeholder در دیتابیس seed یکی است؛ اگر عوضش کردید seed را با --force بزنید.
 */
export type PhotoGroup = 'marina' | 'downtown' | 'coast' | 'creek';

export const PHOTO_POOL: ReadonlyArray<{ key: string; group: PhotoGroup }> = [
  { key: 'marina-dusk', group: 'marina' },
  { key: 'marina-skyline-day', group: 'marina' },
  { key: 'marina-canal', group: 'marina' },
  { key: 'marina-promenade', group: 'marina' },
  { key: 'marina-mosque-towers', group: 'marina' },
  { key: 'marina-blue-towers', group: 'marina' },
  { key: 'marina-jbr-street', group: 'marina' },
  { key: 'marina-bridge', group: 'marina' },
  { key: 'marina-yachts', group: 'marina' },
  { key: 'marina-tall-towers', group: 'marina' },
  { key: 'marina-residences', group: 'marina' },
  { key: 'marina-street-towers', group: 'marina' },
  { key: 'downtown-fountain-burj', group: 'downtown' },
  { key: 'downtown-glass-burj', group: 'downtown' },
  { key: 'downtown-metro-view', group: 'downtown' },
  { key: 'downtown-aerial-night', group: 'downtown' },
  { key: 'downtown-night-skyline', group: 'downtown' },
  { key: 'downtown-park-skyline', group: 'downtown' },
  { key: 'skyline-sunset', group: 'downtown' },
  { key: 'coast-palm-aerial', group: 'coast' },
  { key: 'coast-palm-avenue', group: 'coast' },
  { key: 'coast-palm-street', group: 'coast' },
  { key: 'coast-beach-southwest', group: 'coast' },
  { key: 'coast-burj-al-arab-beach', group: 'coast' },
  { key: 'coast-aerial-towers', group: 'coast' },
  { key: 'coast-marina-beach', group: 'coast' },
  { key: 'creek-old-dubai', group: 'creek' },
];

/** هر محله از کدام گروه عکس بگیرد؛ بقیه‌ی محله‌ها ترکیبی از مارینا و داون‌تاون */
const COMMUNITY_GROUPS: Record<string, PhotoGroup[]> = {
  'dubai-marina': ['marina'],
  'jumeirah-beach-residence': ['marina', 'coast'],
  'jumeirah-lake-towers': ['marina'],
  'al-sufouh': ['marina', 'coast'],
  'downtown-dubai': ['downtown'],
  'business-bay': ['downtown'],
  'city-walk': ['downtown'],
  meydan: ['downtown'],
  'dubai-creek-harbour': ['downtown', 'creek'],
  deira: ['creek', 'downtown'],
  'bur-dubai': ['creek', 'downtown'],
  'palm-jumeirah': ['coast'],
  jumeirah: ['coast'],
  'emaar-beachfront': ['coast'],
};

/**
 * عکس‌های یک محله: اول گروه خودش (`primary` تای اول)، بعد بقیه‌ی مجموعه تا آگهی با عکس زیاد
 * هم تکرار نداشته باشد. عکس اصلی (کاور) آگهی همیشه از گروه خود محله است.
 */
export function photosForCommunity(
  slug: string,
  villa: boolean,
): { indexes: number[]; primary: number } {
  const groups = COMMUNITY_GROUPS[slug] ?? (villa ? ['coast'] : ['marina', 'downtown']);
  const own = PHOTO_POOL.flatMap((p, i) => (groups.includes(p.group) ? [i] : []));
  const rest = PHOTO_POOL.flatMap((_, i) => (own.includes(i) ? [] : [i]));
  return { indexes: [...own, ...rest], primary: own.length };
}
