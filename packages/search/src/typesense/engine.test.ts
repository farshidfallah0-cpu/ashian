import { searchQuerySchema } from '@ashian/shared';
import { describe, expect, it } from 'vitest';
import { toTypesenseFilter } from '../filters.js';
import { makeDocs, NOW } from '../test-fixtures.js';
import type { EngineSearchQuery } from '../types.js';
import { TypesenseClient } from './client.js';
import { TypesenseEngine } from './engine.js';
import { buildSearchPlan, buildSortBy } from './params.js';

const parse = (input: Record<string, unknown>) => searchQuerySchema.parse(input);

const baseQuery = (
  input: Record<string, unknown> = {},
  extra: Partial<EngineSearchQuery> = {},
): EngineSearchQuery => ({
  filters: parse(input),
  text: '',
  now: NOW,
  sort: 'newest',
  verifiedFirst: false,
  offset: 0,
  limit: 20,
  fields: 'light',
  ...extra,
});

describe('toTypesenseFilter', () => {
  it('همیشه انقضا را فیلتر می‌کند', () => {
    expect(toTypesenseFilter({ filters: parse({}), now: NOW })).toBe(`expiresAt:>${NOW}`);
  });

  it('همه‌ی فیلترها به filter_by ترجمه می‌شوند', () => {
    const filter = toTypesenseFilter({
      filters: parse({
        dealType: 'rent,sale',
        propertyType: 'villa',
        location: 'dubai/dubai-marina',
        priceMin: '۵۰۰۰۰',
        priceMax: '200000',
        bedroomsMin: '2',
        areaMax: '3000',
        amenities: 'pool,gym',
        verified: '1',
        cheques: '4',
        postedWithin: '7',
      }),
      now: NOW,
    });
    expect(filter).toContain('dealType:=[`rent`,`sale`]');
    expect(filter).toContain('propertyType:=[`villa`]');
    expect(filter).toContain('locationPaths:=[`dubai/dubai-marina`]');
    expect(filter).toContain('price:>=50000');
    expect(filter).toContain('price:<=200000');
    expect(filter).toContain('bedrooms:>=2');
    expect(filter).toContain('areaSqft:<=3000');
    expect(filter).toContain('amenities:=`pool` && amenities:=`gym`');
    expect(filter).toContain('verified:=1');
    expect(filter).toContain('rentCheques:=4');
    expect(filter).toContain(`publishedAt:>=${NOW - 7 * 86_400}`);
  });

  it('bbox به چندضلعی (lat,lng) تبدیل می‌شود', () => {
    const filter = toTypesenseFilter({ filters: parse({}), now: NOW, bbox: [55, 25, 56, 26] });
    expect(filter).toContain('location:(26, 55, 26, 56, 25, 56, 25, 55)');
  });

  it('کد آگهی و تیر', () => {
    const filter = toTypesenseFilter({
      filters: parse({}),
      now: NOW,
      tier: 'featured',
      code: 10_007,
    });
    expect(filter).toContain('tier:=featured');
    expect(filter).toContain('code:=10007');
  });
});

describe('buildSortBy', () => {
  it('حداکثر ۳ فیلد (محدودیت Typesense)', () => {
    expect(buildSortBy('relevance', true, true).split(',')).toHaveLength(3);
    expect(buildSortBy('relevance', true, true)).toMatch(/^verified:desc,_text_match/);
  });
  it('بدون متن، امتیاز متنی ندارد', () => {
    expect(buildSortBy('relevance', false, false)).toBe('rankScore:desc,publishedAt:desc');
    expect(buildSortBy('price_asc', false, true)).toBe('price:asc,rankScore:desc');
  });
});

describe('buildSearchPlan', () => {
  it('بدون facet فقط یک پرس‌وجو', () => {
    const plan = buildSearchPlan(baseQuery());
    expect(plan.extras).toHaveLength(0);
    expect(plan.main.include_fields).toBe('id,agentId');
    expect(plan.main.q).toBe('*');
  });

  it('facet ناهم‌پیوند: گروه دارای فیلتر فعال پرس‌وجوی جدا و بدون فیلتر خودش می‌گیرد', () => {
    const plan = buildSearchPlan(
      baseQuery({ propertyType: 'villa', bedroomsMin: '2' }, { facets: true }),
    );
    const propertyType = plan.extras.find(
      (e) => e.role.kind === 'facet' && e.role.group === 'propertyType',
    )!;
    expect(String(propertyType.params.filter_by)).not.toContain('propertyType');
    expect(String(propertyType.params.filter_by)).toContain('bedrooms:>=2');
    expect(plan.inMain).not.toContain('propertyType');
    expect(plan.inMain).not.toContain('bedrooms');
    expect(plan.inMain).toContain('dealType');
    expect(String(plan.main.facet_by)).not.toContain('propertyType');
    // ۴ پرس‌وجوی بازه‌ی قیمت/متراژ هم هست
    expect(plan.extras.filter((e) => e.role.kind === 'range')).toHaveLength(4);
  });

  it('متن، تحمل غلط تایپی و پیشوند را فعال می‌کند', () => {
    const plan = buildSearchPlan(baseQuery({}, { text: 'مارینا' }));
    expect(plan.main).toMatchObject({ q: 'مارینا', num_typos: 2, prefix: true });
  });

  it('صفحه‌ی خالی per_page=0 می‌فرستد', () => {
    expect(buildSearchPlan(baseQuery({}, { limit: 0 })).main.per_page).toBe(0);
  });
});

/** سرور جعلی Typesense: درخواست‌ها را ثبت می‌کند و پاسخ از پیش‌تعیین‌شده می‌دهد */
function fakeServer(handler: (method: string, path: string, body: unknown) => unknown) {
  const calls: Array<{ method: string; path: string; body: unknown; key: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const raw = typeof init?.body === 'string' ? init.body : undefined;
    let body: unknown = raw;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      /* JSONL */
    }
    const path = url.pathname + url.search;
    const headers = new Headers(init?.headers);
    calls.push({
      method: init?.method ?? 'GET',
      path,
      body,
      key: headers.get('x-typesense-api-key'),
    });
    const result = handler(init?.method ?? 'GET', path, body);
    if (result instanceof Response) return result;
    return new Response(typeof result === 'string' ? result : JSON.stringify(result ?? {}), {
      status: 200,
    });
  };
  const engine = new TypesenseEngine(
    new TypesenseClient({ url: 'http://ts.test:8108/', apiKey: 'secret', fetch: fetchImpl }),
  );
  return { engine, calls };
}

const notFound = () => new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });

describe('TypesenseEngine', () => {
  it('ensureReady: اگر alias نبود collection و alias می‌سازد', async () => {
    const { engine, calls } = fakeServer((method, path) => {
      if (method === 'GET' && path.startsWith('/aliases/')) return notFound();
      return {};
    });
    await engine.ensureReady();
    const created = calls.filter((c) => c.method === 'POST' && c.path === '/collections');
    expect(created).toHaveLength(2);
    expect(calls.filter((c) => c.method === 'PUT').map((c) => c.path)).toEqual([
      '/aliases/listings',
      '/aliases/suggestions',
    ]);
    expect(calls.every((c) => c.key === 'secret')).toBe(true);
  });

  it('ensureReady: اگر alias بود چیزی نمی‌سازد', async () => {
    const { engine, calls } = fakeServer(() => ({ collection_name: 'listings_v1_1' }));
    await engine.ensureReady();
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('search: نتیجه، facet ناهم‌پیوند و بازه‌ی قیمت را از چند پاسخ می‌سازد', async () => {
    const { engine, calls } = fakeServer((_m, path, body) => {
      if (path !== '/multi_search') return {};
      const first = (body as { searches: Array<{ facet_by?: string }> }).searches[0];
      // پرس‌وجوی هیستوگرام قیمت (facet بازه‌ای)
      if (first?.facet_by?.startsWith('price(')) {
        return {
          results: [
            {
              found: 2,
              hits: [],
              facet_counts: [
                {
                  field_name: 'price',
                  counts: [
                    { value: 'b0', count: 1 },
                    { value: 'b23', count: 1 },
                  ],
                },
              ],
            },
          ],
        };
      }
      return {
        results: [
          {
            found: 2,
            hits: [{ document: { id: 'A', agentId: 'x' } }, { document: { id: 'B', agentId: '' } }],
            facet_counts: [
              { field_name: 'dealType', counts: [{ value: 'rent', count: 2 }] },
              {
                field_name: 'bedrooms',
                counts: [
                  { value: '3', count: 1 },
                  { value: '1', count: 1 },
                ],
              },
              {
                field_name: 'verified',
                counts: [
                  { value: '1', count: 1 },
                  { value: '0', count: 1 },
                ],
              },
            ],
            search_time_ms: 3,
          },
          // propertyType (گروه دارای فیلتر فعال)
          {
            found: 5,
            hits: [],
            facet_counts: [
              {
                field_name: 'propertyType',
                counts: [
                  { value: 'villa', count: 2 },
                  { value: 'apartment', count: 3 },
                ],
              },
            ],
          },
          { found: 2, hits: [{ document: { price: 50_000 } }] },
          { found: 2, hits: [{ document: { price: 900_000 } }] },
          { found: 2, hits: [{ document: { areaSqft: 400 } }] },
          { found: 2, hits: [{ document: { areaSqft: 5_000 } }] },
        ],
      };
    });
    const result = await engine.search(baseQuery({ propertyType: 'villa' }, { facets: true }));
    expect(result.found).toBe(2);
    expect(result.hits).toEqual([
      { id: 'A', agentId: 'x' },
      { id: 'B', agentId: '' },
    ]);
    expect(result.facets!.propertyType).toEqual([
      { value: 'apartment', count: 3 },
      { value: 'villa', count: 2 },
    ]);
    expect(result.facets!.bedrooms.map((o) => o.value)).toEqual(['1', '3']);
    expect(result.facets!.verified).toEqual({ verified: 1, total: 2 });
    expect(result.facets!.price).toEqual({ min: 50_000, max: 900_000 });
    expect(result.facets!.areaSqft).toEqual({ min: 400, max: 5_000 });
    // همه‌ی پرس‌وجوها در یک درخواست multi_search
    // یک درخواست برای نتایج و facetها، یکی برای هیستوگرام قیمت
    expect(calls.filter((c) => c.path === '/multi_search')).toHaveLength(2);
    const histogram = result.facets!.priceHistogram!;
    expect(histogram.edges).toHaveLength(25);
    expect(histogram.edges[0]).toBe(50_000);
    expect(histogram.counts[0]).toBe(1);
    expect(histogram.counts[23]).toBe(1);
    expect(histogram.counts.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('خطای یک پرس‌وجوی multi_search به خطا تبدیل می‌شود', async () => {
    const { engine } = fakeServer(() => ({ results: [{ code: 400, error: 'Bad filter' }] }));
    await expect(engine.search(baseQuery())).rejects.toThrow(/Bad filter/);
  });

  it('getByIds ترتیب ورودی را حفظ می‌کند', async () => {
    const docs = makeDocs(3);
    const { engine } = fakeServer(() => ({
      results: [
        { found: 3, hits: [docs[2]!, docs[0]!, docs[1]!].map((document) => ({ document })) },
      ],
    }));
    const ids = docs.map((d) => d.id);
    expect((await engine.getByIds(ids)).map((d) => d.id)).toEqual(ids);
  });

  it('upsert: JSONL به import می‌فرستد و شکست سند را گزارش می‌کند', async () => {
    const docs = makeDocs(2);
    const ok = fakeServer(() => '{"success":true}\n{"success":true}');
    await ok.engine.upsertListings(docs);
    const call = ok.calls[0]!;
    expect(call.path).toBe('/collections/listings/documents/import?action=upsert');
    expect(String(call.body).split('\n')).toHaveLength(2);

    const bad = fakeServer(
      () => '{"success":true}\n{"success":false,"error":"Field `price` must be int"}',
    );
    await expect(bad.engine.upsertListings(docs)).rejects.toThrow(/ایندکس نشد/);
  });

  it('removeListings با filter_by حذف می‌کند', async () => {
    const { engine, calls } = fakeServer(() => ({ num_deleted: 1 }));
    await engine.removeListings(['abc', 'def']);
    expect(calls[0]!.method).toBe('DELETE');
    expect(decodeURIComponent(calls[0]!.path)).toContain('filter_by=id:=[`abc`,`def`]');
  });

  it('reindex: ایندکس تازه می‌سازد، alias را جابه‌جا و قدیمی را پاک می‌کند', async () => {
    const { engine, calls } = fakeServer((method, path) => {
      if (method === 'GET' && path === '/aliases/listings')
        return { collection_name: 'listings_v1_old' };
      if (method === 'GET' && path === '/aliases/suggestions')
        return { collection_name: 'suggestions_v1_old' };
      if (path.includes('/documents/import')) return '{"success":true}';
      return {};
    });
    const session = await engine.beginReindex();
    await session.addListings(makeDocs(1));
    // تا commit alias دست نخورده
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    await session.commit();
    const puts = calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts[0]!.body).toMatchObject({
      collection_name: expect.stringMatching(/^listings_v1_\d+$/),
    });
    const deletes = calls.filter((c) => c.method === 'DELETE').map((c) => c.path);
    expect(deletes).toEqual(['/collections/listings_v1_old', '/collections/suggestions_v1_old']);
  });

  it('خطای HTTP به TypesenseError با وضعیت تبدیل می‌شود', async () => {
    const { engine } = fakeServer(
      () =>
        new Response(
          '{"message":"Forbidden - a valid `x-typesense-api-key` header must be sent."}',
          { status: 401 },
        ),
    );
    await expect(engine.isEmpty()).rejects.toThrow(/401/);
  });
});
