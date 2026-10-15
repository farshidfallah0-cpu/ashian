import { searchQuerySchema, type SearchFilters } from '@ashian/shared';
import { describe, expect, it } from 'vitest';
import { makeDoc, makeDocs, NOW } from '../test-fixtures.js';
import type { EngineSearchQuery } from '../types.js';
import { MemoryEngine } from './engine.js';

const filters = (input: Record<string, unknown> = {}): SearchFilters =>
  searchQuerySchema.parse(input);

const query = (
  input: Record<string, unknown> = {},
  extra: Partial<EngineSearchQuery> = {},
): EngineSearchQuery => ({
  filters: filters(input),
  text: '',
  now: NOW,
  sort: 'newest',
  verifiedFirst: false,
  offset: 0,
  limit: 50,
  fields: 'full',
  ...extra,
});

async function engineWith(docs = makeDocs(40)) {
  const engine = new MemoryEngine();
  await engine.upsertListings(docs);
  return engine;
}

describe('MemoryEngine فیلتر و مرتب‌سازی', () => {
  it('فیلتر نوع معامله و قیمت دقیق اعمال می‌شود', async () => {
    const docs = [
      makeDoc({ dealType: 'rent', price: 90_000 }, 0),
      makeDoc({ dealType: 'sale', price: 2_000_000 }, 1),
      makeDoc({ dealType: 'rent', price: 150_000 }, 2),
    ];
    const engine = await engineWith(docs);
    const result = await engine.search(query({ dealType: 'rent', priceMax: '100000' }));
    expect(result.hits.map((h) => h.id)).toEqual([docs[0]!.id]);
  });

  it('ارقام فارسی در فیلترها پذیرفته می‌شود', async () => {
    const engine = await engineWith();
    const persian = await engine.search(query({ priceMin: '۹۰٬۰۰۰' }));
    const english = await engine.search(query({ priceMin: '90000' }));
    expect(persian.found).toBe(english.found);
    expect(persian.found).toBeGreaterThan(0);
  });

  it('فیلتر مکان همه‌ی زیرمجموعه‌ها را شامل می‌شود', async () => {
    const tower = makeDoc(
      {
        place: {
          slug: 'marina-gate-1',
          nameFa: 'مارینا گیت ۱',
          nameEn: 'Marina Gate 1',
          aliases: [],
          type: 'tower',
          path: 'dubai/dubai-marina/marina-gate-1',
        },
      },
      0,
    );
    const engine = await engineWith([tower, makeDoc({}, 1)]);
    expect((await engine.search(query({ location: 'dubai/dubai-marina' }))).found).toBe(1);
    expect(
      (await engine.search(query({ location: 'dubai/dubai-marina/marina-gate-1' }))).found,
    ).toBe(1);
    expect((await engine.search(query({ location: 'dubai' }))).found).toBe(2);
  });

  it('امکانات با AND اعمال می‌شود', async () => {
    const engine = await engineWith(makeDocs(12));
    const both = await engine.search(query({ amenities: 'pool,gym' }));
    expect(
      both.hits.every((h) => h.doc!.amenities.includes('pool') && h.doc!.amenities.includes('gym')),
    ).toBe(true);
    expect(both.found).toBe(4);
  });

  it('آگهی منقضی هرگز برنمی‌گردد', async () => {
    const expired = makeDoc({ expiresAt: new Date((NOW - 10) * 1000) }, 0);
    const engine = await engineWith([expired, makeDoc({}, 1)]);
    expect((await engine.search(query())).found).toBe(1);
  });

  it('مرتب‌سازی قیمت و متراژ', async () => {
    const engine = await engineWith();
    const asc = await engine.search(query({}, { sort: 'price_asc' }));
    const prices = asc.hits.map((h) => h.doc!.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const area = await engine.search(query({}, { sort: 'area_desc' }));
    const areas = area.hits.map((h) => h.doc!.areaSqft);
    expect(areas).toEqual([...areas].sort((a, b) => b - a));
  });

  it('«تأییدشده‌ها اول» در هر مرتب‌سازی بالاتر می‌نشیند', async () => {
    const docs = makeDocs(10, (i) => ({ isVerified: i === 7 }));
    const engine = await engineWith(docs);
    const result = await engine.search(query({}, { sort: 'price_desc', verifiedFirst: true }));
    expect(result.hits[0]!.doc!.verified).toBe(1);
  });

  it('صفحه‌بندی با offset و limit', async () => {
    const engine = await engineWith();
    const all = await engine.search(query());
    const page = await engine.search(query({}, { offset: 10, limit: 5 }));
    expect(page.found).toBe(all.found);
    expect(page.hits.map((h) => h.id)).toEqual(all.hits.slice(10, 15).map((h) => h.id));
  });

  it('bbox فقط آگهی‌های داخل محدوده را می‌دهد', async () => {
    const engine = await engineWith();
    const result = await engine.search(query({}, { bbox: [55.1, 25.07, 55.17, 25.09] }));
    expect(result.found).toBeGreaterThan(0);
    expect(result.hits.every((h) => h.doc!.communitySlug === 'dubai-marina')).toBe(true);
  });
});

describe('MemoryEngine جستجوی متنی', () => {
  it('نام محله را پیدا می‌کند', async () => {
    const engine = await engineWith();
    const result = await engine.search(query({}, { text: 'مارینا' }));
    expect(result.found).toBe(20);
  });

  it('غلط تایپی را تحمل می‌کند', async () => {
    const engine = await engineWith();
    const result = await engine.search(query({}, { text: 'maraina' }));
    expect(result.found).toBe(20);
  });

  it('پیشوند واژه‌ی آخر کافی است', async () => {
    const engine = await engineWith();
    expect((await engine.search(query({}, { text: 'dubai mar' }))).found).toBe(20);
  });

  it('نام لاتین و اختصار (alias) هم کار می‌کند', async () => {
    const engine = await engineWith();
    expect((await engine.search(query({}, { text: 'jvc' }))).found).toBe(20);
  });

  it('متن نامرتبط نتیجه‌ای ندارد', async () => {
    const engine = await engineWith();
    expect((await engine.search(query({}, { text: 'zzzzqqq' }))).found).toBe(0);
  });

  it('جستجو با کد آگهی', async () => {
    const engine = await engineWith();
    const result = await engine.search(query({}, { code: 10_007 }));
    expect(result.hits.map((h) => h.doc!.code)).toEqual([10_007]);
  });

  it('مرتبط‌ترین: تطبیق مکان از تطبیق ضعیف‌تر بالاتر است', async () => {
    const strong = makeDoc({ title: 'واحد معمولی' }, 0); // مکان مارینا
    const weak = makeDoc({ title: 'نزدیک مارینا' }, 1); // مکان JVC، اسم مارینا فقط در عنوان
    const engine = await engineWith([weak, strong]);
    const result = await engine.search(query({}, { text: 'مارینا', sort: 'relevance' }));
    expect(result.hits[0]!.id).toBe(strong.id);
  });
});

describe('MemoryEngine facet', () => {
  it('شمارش هر گزینه با فیلترهای فعال می‌خواند', async () => {
    const docs = makeDocs(40);
    const engine = await engineWith(docs);
    const result = await engine.search(query({ bedroomsMin: '2' }, { facets: true }));
    const total = result.facets!.community.reduce((s, o) => s + o.count, 0);
    expect(total).toBe(result.found);
  });

  it('facet ناهم‌پیوند: با انتخاب یک نوع، تعداد بقیه‌ی نوع‌ها صفر نمی‌شود', async () => {
    const docs = [
      ...makeDocs(6, () => ({ propertyType: 'apartment' as const })),
      ...Array.from({ length: 4 }, (_, i) => makeDoc({ propertyType: 'villa' }, 20 + i)),
    ];
    const engine = await engineWith(docs);
    const result = await engine.search(query({ propertyType: 'villa' }, { facets: true }));
    expect(result.found).toBe(4);
    const byType = Object.fromEntries(result.facets!.propertyType.map((o) => [o.value, o.count]));
    expect(byType).toEqual({ apartment: 6, villa: 4 });
  });

  it('بازه‌ی قیمت و متراژ نادیده‌گرفتنِ فیلتر خودشان را دارد', async () => {
    const engine = await engineWith();
    const result = await engine.search(query({ priceMin: '100000' }, { facets: true }));
    expect(result.facets!.price!.min).toBeLessThan(100_000);
  });

  it('هیستوگرام قیمت: لبه‌های لگاریتمی، جمع برابر آگهی‌ها و فیلتر قیمت را نادیده می‌گیرد', async () => {
    const engine = await engineWith();
    const all = await engine.search(query({}, { facets: true }));
    const h = all.facets!.priceHistogram!;
    expect(h.edges).toHaveLength(25);
    expect(h.edges).toEqual([...h.edges].sort((a, b) => a - b));
    expect(h.counts.reduce((s, c) => s + c, 0)).toBe(all.found);

    const filtered = await engine.search(query({ priceMin: '100000' }, { facets: true }));
    expect(filtered.facets!.priceHistogram!.counts.reduce((s, c) => s + c, 0)).toBe(all.found);
  });

  it('تعداد خواب به ترتیب عددی می‌آید', async () => {
    const engine = await engineWith();
    const result = await engine.search(query({}, { facets: true }));
    const beds = result.facets!.bedrooms.map((o) => Number(o.value));
    expect(beds).toEqual([...beds].sort((a, b) => a - b));
  });

  it('شمار تأییدشده‌ها', async () => {
    const docs = makeDocs(10, (i) => ({ isVerified: i < 3 }));
    const engine = await engineWith(docs);
    const result = await engine.search(query({}, { facets: true }));
    expect(result.facets!.verified).toEqual({ verified: 3, total: 10 });
  });
});

describe('MemoryEngine نقشه، پیشنهاد و reindex', () => {
  it('سلول‌های geohash را می‌شمارد', async () => {
    const engine = await engineWith();
    const cells = await engine.geoCells(
      { filters: filters(), text: '', now: NOW, bbox: [55, 25, 55.5, 25.2] },
      4,
    );
    expect(cells.found).toBe(40);
    expect(cells.cells.reduce((s, c) => s + c.count, 0)).toBe(40);
    expect(cells.cells.length).toBeGreaterThanOrEqual(2);
  });

  it('پین‌ها فقط سلول‌های خواسته‌شده را می‌دهند', async () => {
    const engine = await engineWith();
    const scope = { filters: filters(), text: '', now: NOW };
    const cells = await engine.geoCells(scope, 4);
    const first = cells.cells[0]!;
    const { pins } = await engine.pins(scope, {
      limit: 100,
      cells: { precision: 4, hashes: [first.hash] },
    });
    expect(pins).toHaveLength(first.count);
  });

  it('پیشنهاد: محله با اولویت و تحمل غلط تایپی', async () => {
    const engine = new MemoryEngine();
    await engine.replaceSuggestions([
      {
        id: 'a',
        kind: 'agent',
        ref: '1',
        label: 'مارینا احمدی',
        sublabel: '',
        searchText: 'مارینا احمدی',
        listingCount: 3,
      },
      {
        id: 'c',
        kind: 'community',
        ref: 'dubai/dubai-marina',
        label: 'دبی مارینا',
        sublabel: 'Dubai Marina',
        searchText: 'دبی مارینا dubai marina',
        listingCount: 50,
      },
    ]);
    const result = await engine.suggest('مارین', 5);
    expect(result[0]!.kind).toBe('community');
    expect((await engine.suggest('dubay marina', 5))[0]?.kind).toBe('community');
  });

  it('reindex تا commit روی ایندکس زنده اثر ندارد و بعد اتمیک جایگزین می‌شود', async () => {
    const engine = await engineWith(makeDocs(5));
    const session = await engine.beginReindex();
    await session.addListings(makeDocs(2));
    expect((await engine.stats()).listings).toBe(5);
    await session.commit();
    expect((await engine.stats()).listings).toBe(2);
  });

  it('حذف و upsert', async () => {
    const docs = makeDocs(3);
    const engine = await engineWith(docs);
    await engine.removeListings([docs[0]!.id]);
    expect((await engine.getByIds(docs.map((d) => d.id))).map((d) => d.id)).toEqual([
      docs[1]!.id,
      docs[2]!.id,
    ]);
    expect(await engine.isEmpty()).toBe(false);
  });
});
