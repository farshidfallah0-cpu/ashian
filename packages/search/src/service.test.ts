import { MemoryCache } from '@ashian/infra';
import { searchQuerySchema, mapQuerySchema } from '@ashian/shared';
import { describe, expect, it } from 'vitest';
import { MemoryEngine } from './memory/engine.js';
import { SearchService } from './service.js';
import { makeDoc, NOW } from './test-fixtures.js';

/** ۱۲۰ آگهی؛ هر مشاور ۴ آگهی پشت‌سرهم دارد و ۸ آگهی ویژه */
async function setup() {
  const engine = new MemoryEngine();
  const docs = Array.from({ length: 120 }, (_, i) =>
    makeDoc(
      {
        tier: i % 15 === 3 ? 'featured' : 'standard',
        agent: {
          id: `agent-${Math.floor(i / 4) % 12}`,
          name: `مشاور ${Math.floor(i / 4) % 12}`,
          avatarKey: null,
          isVerified: true,
          isTopAgent: false,
          agencyName: null,
        },
      },
      i,
    ),
  );
  await engine.upsertListings(docs);
  await engine.replaceSuggestions([
    {
      id: 'c1',
      kind: 'community',
      ref: 'dubai/dubai-marina',
      label: 'دبی مارینا',
      sublabel: 'Dubai Marina',
      searchText: 'دبی مارینا dubai marina',
      listingCount: 60,
    },
  ]);
  const service = new SearchService({ engine, cache: new MemoryCache(), now: () => NOW });
  return { service, docs };
}

const q = (input: Record<string, unknown> = {}) => searchQuerySchema.parse(input);

describe('SearchService.searchListings', () => {
  it('صفحه‌ی اول: اندازه، جمع، facet و برچسب ویژه', async () => {
    const { service } = await setup();
    const result = await service.searchListings(q());
    expect(result.items).toHaveLength(20);
    expect(result.total).toBe(120);
    expect(result.totalPages).toBe(6);
    expect(result.facets?.dealType).toEqual([{ value: 'rent', count: 120 }]);
    const featured = result.items.filter((i) => i.placement === 'featured');
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.length).toBeLessThanOrEqual(3);
    expect(featured.every((i) => i.tier === 'featured')).toBe(true);
  });

  it('ویژه‌ها در جایگاه‌های ثابت ۰، ۴، ۸', async () => {
    const { service } = await setup();
    const result = await service.searchListings(q());
    const positions = result.items.flatMap((item, index) =>
      item.placement === 'featured' ? [index] : [],
    );
    expect(positions).toEqual([0, 4, 8].slice(0, positions.length));
  });

  it('هیچ آگهی‌ای بین صفحه‌ها تکرار نمی‌شود و همه دیده می‌شوند', async () => {
    const { service } = await setup();
    const seen = new Set<string>();
    for (let page = 1; page <= 6; page++) {
      const result = await service.searchListings(q({ page: String(page) }));
      for (const item of result.items) {
        expect(seen.has(item.publicId)).toBe(false);
        seen.add(item.publicId);
      }
    }
    expect(seen.size).toBe(120);
  });

  it('در کل صفحه‌ها هیچ مشاوری بیش از ۲ آگهی پشت‌سرهم ندارد', async () => {
    const { service } = await setup();
    const agents: string[] = [];
    for (let page = 1; page <= 6; page++) {
      const result = await service.searchListings(q({ page: String(page) }));
      agents.push(...result.items.map((i) => i.agent?.id ?? ''));
    }
    let run = 1;
    for (let i = 1; i < agents.length; i++) {
      run = agents[i] === agents[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });

  it('فیلتر دقیق اعمال می‌شود و جمع و facet با آن می‌خواند', async () => {
    const { service } = await setup();
    const result = await service.searchListings(
      q({ location: 'dubai/dubai-marina', bedroomsMin: '2' }),
    );
    expect(result.items.every((i) => i.community.slug === 'dubai-marina' && i.bedrooms >= 2)).toBe(
      true,
    );
    expect(result.facets!.community.map((o) => o.value)).toContain('dubai-marina');
    // facet محله ناهم‌پیوند است: محله‌ی دیگر هم با تعداد نشان داده می‌شود
    expect(result.facets!.community.map((o) => o.value)).toContain('jumeirah-village-circle');
  });

  it('صفحه‌ی بعد از آخر خالی است', async () => {
    const { service } = await setup();
    const result = await service.searchListings(q({ page: '50' }));
    expect(result.items).toEqual([]);
    expect(result.total).toBe(120);
  });

  it('facets=0 شمارش نمی‌فرستد', async () => {
    const { service } = await setup();
    expect((await service.searchListings(q({ facets: '0' }))).facets).toBeNull();
  });

  it('جستجو با کد آگهی (ارقام فارسی)', async () => {
    const { service } = await setup();
    const result = await service.searchListings(q({ q: '۱۰۰۰۷' }));
    expect(result.items.map((i) => i.code)).toEqual([10_007]);
  });

  it('جستجوی متنی با یکسان‌سازی فارسی', async () => {
    const { service } = await setup();
    const a = await service.searchListings(q({ q: 'مارينا' })); // ي عربی
    expect(a.total).toBe(60);
  });

  it('تأییدشده‌ها اول', async () => {
    const engine = new MemoryEngine();
    await engine.upsertListings(
      Array.from({ length: 10 }, (_, i) => makeDoc({ isVerified: i === 9 }, i)),
    );
    const service = new SearchService({ engine, cache: new MemoryCache(), now: () => NOW });
    const result = await service.searchListings(q({ verifiedFirst: '1', sort: 'price_asc' }));
    expect(result.items[0]!.isVerified).toBe(true);
  });

  it('نتیجه‌ی یکسان از کش می‌آید', async () => {
    const { service } = await setup();
    const a = await service.searchListings(q());
    const b = await service.searchListings(q());
    expect(b).toEqual(a);
  });
});

describe('SearchService.map', () => {
  it('محدوده‌ی کم‌آگهی: همه‌ی پین‌ها تکی', async () => {
    const { service } = await setup();
    const result = await service.map(
      mapQuerySchema.parse({ bbox: '55,25,55.5,25.2', zoom: '12', location: 'dubai/dubai-marina' }),
    );
    expect(result.clusters).toEqual([]);
    expect(result.pins).toHaveLength(60);
    expect(result.truncated).toBe(false);
  });

  it('محدوده‌ی شلوغ در زوم دور: خوشه می‌سازد و جمع حفظ می‌شود', async () => {
    const engine = new MemoryEngine();
    await engine.upsertListings(
      Array.from({ length: 300 }, (_, i) =>
        makeDoc({ lng: 55.1 + (i % 30) * 0.01, lat: 25.0 + Math.floor(i / 30) * 0.01 }, i),
      ),
    );
    const service = new SearchService({ engine, cache: new MemoryCache(), now: () => NOW });
    const result = await service.map(mapQuerySchema.parse({ bbox: '54,24,56,26', zoom: '9' }));
    expect(result.total).toBe(300);
    expect(result.clusters.length).toBeGreaterThan(0);
    const counted = result.clusters.reduce((s, c) => s + c.count, 0) + result.pins.length;
    expect(counted).toBe(300);
  });
});

describe('SearchService.suggest', () => {
  it('محله را پیشنهاد می‌دهد', async () => {
    const { service } = await setup();
    const result = await service.suggest('مارین', 5);
    expect(result.items[0]).toMatchObject({
      kind: 'community',
      ref: 'dubai/dubai-marina',
      listingCount: 60,
    });
  });

  it('کد آگهی را به خود آگهی می‌رساند', async () => {
    const { service } = await setup();
    const result = await service.suggest('10005', 5);
    expect(result.items[0]).toMatchObject({ kind: 'listing' });
  });

  it('ورودی خالی نتیجه‌ای ندارد', async () => {
    const { service } = await setup();
    expect((await service.suggest('  ', 5)).items).toEqual([]);
  });
});
