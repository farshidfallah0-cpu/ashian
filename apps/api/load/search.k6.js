// تست بار جستجو با k6 (روی حالت full: Typesense + Redis):
//   k6 run -e BASE=http://localhost:4000 apps/api/load/search.k6.js
// سناریو: ۵۰۰ کاربر هم‌زمان با ترکیب واقعی فیلتر، متن، نقشه و پیشنهاد خودکار.
// آستانه‌ها هدف‌های پروژه‌اند؛ اگر نقض شوند k6 با خطا خارج می‌شود (برای CI).
/* global __ENV */
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:4000';

export const options = {
  scenarios: {
    search: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 500),
      duration: __ENV.DURATION || '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300'],
    'http_req_duration{endpoint:suggest}': ['p(95)<50'],
  },
};

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const int = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const scenarios = [
  () => ['listings', '/v1/search/listings?dealType=rent&sort=newest'],
  () => [
    'listings',
    `/v1/search/listings?dealType=rent&bedroomsMin=${int(0, 3)}&priceMax=${int(5, 40) * 10000}`,
  ],
  () => [
    'listings',
    `/v1/search/listings?dealType=sale&propertyType=${pick(['apartment', 'villa', 'townhouse'])}&sort=price_asc&page=${int(1, 5)}`,
  ],
  () => [
    'listings',
    `/v1/search/listings?q=${encodeURIComponent(pick(['مارینا', 'جمیرا', 'downtown', 'marina', 'palm']))}`,
  ],
  () => [
    'listings',
    `/v1/search/listings?verified=1&verifiedFirst=1&areaMin=${int(3, 20) * 100}&page=${int(1, 8)}&facets=0`,
  ],
  () => [
    'map',
    `/v1/search/map?bbox=54.9,24.9,55.6,25.4&zoom=${int(9, 13)}&dealType=${pick(['rent', 'sale'])}`,
  ],
  () => [
    'suggest',
    `/v1/search/suggest?q=${encodeURIComponent(pick(['مار', 'جمی', 'dub', 'pal', 'داون']))}`,
  ],
];

export default function () {
  const [endpoint, path] = pick(scenarios)();
  const res = http.get(BASE + path, { tags: { endpoint } });
  check(res, { 'وضعیت ۲۰۰': (r) => r.status === 200 });
}
