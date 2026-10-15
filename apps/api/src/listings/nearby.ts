import { NEARBY_CATEGORIES, type NearbyCategory, type NearbyPlace } from '@ashian/shared';
import { PLACES } from './nearby-data.js';

/** بیشترین فاصله‌ی هوایی (متر) که هر دسته در نظر گرفته می‌شود */
const MAX_DISTANCE_M: Record<NearbyCategory, number> = {
  metro: 6_000,
  mall: 8_000,
  hospital: 8_000,
  school: 6_000,
};

const PER_CATEGORY = 3;
/** مسیر پیاده معمولاً حدود ۳۰٪ از خط مستقیم بلندتر است */
const ROUTE_FACTOR = 1.3;
const WALK_METERS_PER_MINUTE = 80;

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** فاصله‌ی هوایی دو نقطه (haversine) به متر */
export function distanceMeters(a: [lng: number, lat: number], b: [lng: number, lat: number]) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** نزدیک‌ترین نقاط شاخص (حداکثر ۳ مورد در هر دسته) به‌ترتیب دسته و فاصله */
export function findNearby(lng: number, lat: number): NearbyPlace[] {
  const result: NearbyPlace[] = [];
  for (const category of NEARBY_CATEGORIES) {
    const nearest = PLACES.filter((p) => p.category === category)
      .map((p) => ({ place: p, distanceM: Math.round(distanceMeters([lng, lat], [p.lng, p.lat])) }))
      .filter((x) => x.distanceM <= MAX_DISTANCE_M[category])
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, PER_CATEGORY);
    for (const { place, distanceM } of nearest) {
      result.push({
        category,
        nameFa: place.nameFa,
        nameEn: place.nameEn,
        distanceM,
        walkMinutes: Math.max(1, Math.round((distanceM * ROUTE_FACTOR) / WALK_METERS_PER_MINUTE)),
        lng: place.lng,
        lat: place.lat,
      });
    }
  }
  return result;
}
