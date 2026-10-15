// تست بار جستجو بدون ابزار خارجی: node scripts/search-load.mjs [--total=5000] [--concurrency=500] [--base=http://localhost:4000]
// خروجی: درخواست بر ثانیه، خطاها و صدک‌های ۵۰/۹۵/۹۹ برای هر endpoint.
// هدف پروژه: p95 زیر ۳۰۰ms روی حالت full. اجرا روی lite فقط برای دیدن رفتار و پیدا کردن خطا است.
// معادل k6 (برای محیط CI و تست واقعی ۳۰ هزار کاربر): apps/api/load/search.k6.js

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const BASE = arg('base', 'http://localhost:4000');
const TOTAL = Number(arg('total', 5000));
const CONCURRENCY = Number(arg('concurrency', 500));

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const int = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const QUERIES = [
  ['listings', () => '/v1/search/listings?dealType=rent&sort=newest'],
  [
    'listings',
    () =>
      `/v1/search/listings?dealType=rent&bedroomsMin=${int(0, 3)}&priceMax=${int(5, 40) * 10_000}`,
  ],
  [
    'listings',
    () =>
      `/v1/search/listings?dealType=sale&propertyType=${pick(['apartment', 'villa', 'townhouse'])}&sort=price_asc&page=${int(1, 5)}`,
  ],
  [
    'listings',
    () =>
      `/v1/search/listings?q=${encodeURIComponent(pick(['مارینا', 'جمیرا', 'downtown', 'marina', 'palm', 'مارینا گیت']))}`,
  ],
  [
    'listings',
    () =>
      `/v1/search/listings?verified=1&verifiedFirst=1&areaMin=${int(3, 20) * 100}&page=${int(1, 8)}&facets=0`,
  ],
  [
    'map',
    () =>
      `/v1/search/map?bbox=54.9,24.9,55.6,25.4&zoom=${int(9, 13)}&dealType=${pick(['rent', 'sale'])}`,
  ],
  [
    'suggest',
    () =>
      `/v1/search/suggest?q=${encodeURIComponent(pick(['مار', 'جمی', 'dub', 'pal', 'داون', 'علی', 'bus']))}`,
  ],
];

const timings = new Map();
let errors = 0;
let issued = 0;

async function worker() {
  while (issued < TOTAL) {
    issued++;
    const [label, build] = pick(QUERIES);
    const started = performance.now();
    try {
      const response = await fetch(BASE + build());
      await response.arrayBuffer();
      if (!response.ok) errors++;
    } catch {
      errors++;
    }
    const list = timings.get(label) ?? [];
    list.push(performance.now() - started);
    timings.set(label, list);
  }
}

const percentile = (sorted, p) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
const fmt = (n) => `${n.toFixed(0)}ms`.padStart(7);

console.log(`⏱  ${TOTAL} درخواست، هم‌زمانی ${CONCURRENCY}، سرور ${BASE}`);
const started = performance.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const seconds = (performance.now() - started) / 1000;

const all = [...timings.values()].flat().sort((a, b) => a - b);
console.log(
  `\nکل: ${all.length} درخواست در ${seconds.toFixed(1)}s (${(all.length / seconds).toFixed(0)} req/s)، خطا: ${errors}`,
);
console.log('endpoint      p50      p95      p99      max');
for (const [label, list] of [...timings.entries(), ['همه', all]]) {
  const sorted = [...list].sort((a, b) => a - b);
  console.log(
    `${String(label).padEnd(10)} ${fmt(percentile(sorted, 50))} ${fmt(percentile(sorted, 95))} ${fmt(percentile(sorted, 99))} ${fmt(sorted.at(-1) ?? 0)}`,
  );
}
const p95 = percentile(all, 95);
console.log(
  `\np95 کل = ${p95.toFixed(0)}ms  ${p95 < 300 ? '✔ زیر هدف ۳۰۰ms' : '✘ بالاتر از هدف ۳۰۰ms'}`,
);
process.exit(errors > all.length * 0.01 ? 1 : 0);
