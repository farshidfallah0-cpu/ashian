const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** رمزگذاری geohash با دقت دلخواه (تعداد کاراکتر) */
export function encodeGeohash(lat: number, lng: number, precision: number): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[ch]!;
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** مرکز سلول geohash */
export function decodeGeohash(hash: string): { lat: number; lng: number } {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let even = true;

  for (const char of hash) {
    const value = BASE32.indexOf(char);
    if (value < 0) throw new Error(`geohash نامعتبر: ${hash}`);
    for (let mask = 16; mask > 0; mask >>= 1) {
      const set = (value & mask) !== 0;
      if (even) {
        const mid = (lngMin + lngMax) / 2;
        if (set) lngMin = mid;
        else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (set) latMin = mid;
        else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 };
}

export type GeoPrecision = 3 | 4 | 5 | 6;

/**
 * دقت خوشه‌بندی بر اساس زوم نقشه:
 * هر چه نزدیک‌تر، سلول‌ها کوچک‌تر (۳ ≈ ۱۵۶ کیلومتر … ۶ ≈ ۱٫۲ کیلومتر).
 */
export function precisionForZoom(zoom: number): GeoPrecision {
  if (zoom < 8) return 3;
  if (zoom < 10) return 4;
  if (zoom < 12) return 5;
  return 6;
}
