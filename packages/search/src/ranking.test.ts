import { describe, expect, it } from 'vitest';
import {
  arrangePage,
  composePage,
  computeRankScore,
  featuredPerPage,
  pickFeatured,
  type Rankable,
} from './ranking.js';

const item = (id: string, agentId: string): Rankable => ({ id, agentId });

/** بیشینه‌ی تعداد پشت‌سرهم برای یک مشاور در یک دنباله */
function longestRun(items: Rankable[]): number {
  let longest = 0;
  let run = 0;
  let previous = '';
  for (const { agentId } of items) {
    run = agentId && agentId === previous ? run + 1 : 1;
    previous = agentId;
    longest = Math.max(longest, run);
  }
  return longest;
}

describe('computeRankScore', () => {
  const base = {
    qualityScore: 80,
    photoCount: 8,
    isVerified: false,
    isTopAgent: false,
    publishedAt: 1_000_000,
    now: 1_000_000,
  };

  it('آگهی تازه از قدیمی بالاتر است', () => {
    const fresh = computeRankScore(base);
    const old = computeRankScore({ ...base, now: base.publishedAt + 60 * 86_400 });
    expect(fresh).toBeGreaterThan(old);
  });

  it('تأییدشده امتیاز بیشتری می‌گیرد', () => {
    expect(computeRankScore({ ...base, isVerified: true })).toBeGreaterThan(computeRankScore(base));
  });

  it('آگهی بی‌کیفیت (عکس کم یا اطلاعات ناقص) به‌شدت پایین می‌آید', () => {
    const good = computeRankScore(base);
    expect(computeRankScore({ ...base, photoCount: 1 })).toBeLessThan(good * 0.5);
    expect(computeRankScore({ ...base, qualityScore: 30 })).toBeLessThan(good * 0.5);
  });

  it('همیشه بین ۰ و ۱۰۰۰ است', () => {
    const max = computeRankScore({
      ...base,
      qualityScore: 100,
      isVerified: true,
      isTopAgent: true,
    });
    expect(max).toBeLessThanOrEqual(1000);
    expect(computeRankScore({ ...base, qualityScore: 0, photoCount: 0 })).toBeGreaterThanOrEqual(0);
  });
});

describe('featuredPerPage', () => {
  it('هیچ‌وقت از ۳ بیشتر نمی‌شود', () => {
    expect(featuredPerPage(50, 100)).toBe(3);
    expect(featuredPerPage(20, 100)).toBe(3);
  });
  it('به تعداد ویژه‌های موجود و اندازه‌ی صفحه محدود است', () => {
    expect(featuredPerPage(20, 2)).toBe(2);
    expect(featuredPerPage(20, 0)).toBe(0);
    expect(featuredPerPage(8, 10)).toBe(2);
    expect(featuredPerPage(3, 10)).toBe(0);
  });
});

describe('arrangePage', () => {
  it('هیچ مشاوری بیش از ۲ آگهی پشت‌سرهم ندارد', () => {
    const organic = [
      ...Array.from({ length: 5 }, (_, i) => item(`a${i}`, 'A')),
      ...Array.from({ length: 5 }, (_, i) => item(`b${i}`, 'B')),
      ...Array.from({ length: 5 }, (_, i) => item(`c${i}`, 'C')),
    ];
    const result = arrangePage(organic, []);
    expect(result).toHaveLength(15);
    expect(longestRun(result)).toBeLessThanOrEqual(2);
    expect(new Set(result.map((r) => r.id)).size).toBe(15);
  });

  it('ترتیب اصلی را تا جای ممکن نگه می‌دارد', () => {
    const organic = [item('1', 'A'), item('2', 'B'), item('3', 'C'), item('4', 'A')];
    expect(arrangePage(organic, []).map((r) => r.id)).toEqual(['1', '2', '3', '4']);
  });

  it('وقتی همه از یک مشاورند چاره‌ای نیست و آگهی‌ها حذف نمی‌شوند', () => {
    const organic = Array.from({ length: 6 }, (_, i) => item(`a${i}`, 'A'));
    expect(arrangePage(organic, [])).toHaveLength(6);
  });

  it('آگهی بدون مشاور محدود نمی‌شود', () => {
    const organic = Array.from({ length: 6 }, (_, i) => item(`s${i}`, ''));
    expect(arrangePage(organic, []).map((r) => r.id)).toEqual(organic.map((r) => r.id));
  });

  it('ویژه‌ها در جایگاه‌های ثابت ۰، ۴ و ۸ می‌نشینند', () => {
    const organic = Array.from({ length: 17 }, (_, i) => item(`o${i}`, `agent${i}`));
    const featured = [item('f0', 'x0'), item('f1', 'x1'), item('f2', 'x2')];
    const result = arrangePage(organic, featured);
    expect(result).toHaveLength(20);
    expect([result[0]!.id, result[4]!.id, result[8]!.id]).toEqual(['f0', 'f1', 'f2']);
  });

  it('مرز صفحه با carry رعایت می‌شود', () => {
    const organic = [item('a1', 'A'), item('a2', 'A'), item('b1', 'B'), item('b2', 'B')];
    const result = arrangePage(organic, [], ['A', 'A']);
    expect(result[0]!.agentId).toBe('B');
  });

  it('ویژه‌ی هم‌مشاور با همسایه‌ها run سه‌تایی نمی‌سازد', () => {
    const organic = [
      item('a1', 'A'),
      item('a2', 'A'),
      item('a3', 'A'),
      item('b1', 'B'),
      item('b2', 'B'),
    ];
    const result = arrangePage(organic, [item('f', 'A')]);
    expect(longestRun(result)).toBeLessThanOrEqual(2);
  });
});

describe('pickFeatured', () => {
  const pool = Array.from({ length: 6 }, (_, i) => item(`f${i}`, `agent${i}`));

  it('بین صفحه‌ها می‌چرخد و تکرار نمی‌کند', () => {
    const p1 = pickFeatured(pool, 3, 1, 0).map((i) => i.id);
    const p2 = pickFeatured(pool, 3, 2, 0).map((i) => i.id);
    expect(new Set([...p1, ...p2]).size).toBe(6);
  });

  it('با seed یکسان نتیجه‌ی یکسان می‌دهد', () => {
    expect(pickFeatured(pool, 3, 1, 7)).toEqual(pickFeatured(pool, 3, 1, 7));
  });

  it('مشاورهای متفاوت را ترجیح می‌دهد', () => {
    const mixed = [item('a', 'A'), item('b', 'A'), item('c', 'B'), item('d', 'C')];
    const picked = pickFeatured(mixed, 3, 1, 0).map((i) => i.agentId);
    expect(new Set(picked).size).toBe(3);
  });

  it('مواردِ exclude را برنمی‌دارد', () => {
    const picked = pickFeatured(pool, 3, 1, 0, new Set(['f0', 'f1']));
    expect(picked.map((i) => i.id)).not.toContain('f0');
    expect(picked.map((i) => i.id)).not.toContain('f1');
  });
});

describe('composePage', () => {
  // ۲۰۰ آگهی از ۱۰ مشاور (هر ۱۰ تا یکی)؛ ۱۰ تای آن‌ها ویژه
  const all: Rankable[] = Array.from({ length: 200 }, (_, i) =>
    item(`l${i}`, `agent${Math.floor(i / 3) % 10}`),
  );
  const featuredPool = all.filter((_, i) => i % 20 === 5);

  const run = (page: number, pageSize = 20) =>
    composePage({ organic: all, featuredPool, page, pageSize, seed: 3 });

  it('هر صفحه دقیقاً pageSize آگهی دارد', () => {
    for (const page of [1, 2, 5, 9]) expect(run(page)).toHaveLength(20);
  });

  it('در هر صفحه حداکثر ۳ ویژه هست و در جایگاه‌های ثابت', () => {
    for (const page of [1, 2, 3, 4]) {
      const result = run(page);
      const slots = result.flatMap((r, i) => (r.featured ? [i] : []));
      expect(slots.length).toBeLessThanOrEqual(3);
      expect(slots.every((s) => [0, 4, 8].includes(s))).toBe(true);
    }
  });

  it('هیچ آگهی‌ای بین صفحه‌ها تکرار نمی‌شود', () => {
    const seen = new Set<string>();
    for (let page = 1; page <= 10; page++) {
      for (const { item: i } of run(page)) {
        expect(seen.has(i.id)).toBe(false);
        seen.add(i.id);
      }
    }
    expect(seen.size).toBe(200);
  });

  it('در هیچ صفحه‌ای و حتی مرز صفحه‌ها مشاوری بیش از ۲ پشت‌سرهم ندارد', () => {
    const sequence: Rankable[] = [];
    for (let page = 1; page <= 10; page++) sequence.push(...run(page).map((r) => r.item));
    expect(longestRun(sequence)).toBeLessThanOrEqual(2);
  });

  it('بدون ویژه فقط ترتیب عادی با رعایت قانون مشاور است', () => {
    const result = composePage({ organic: all, featuredPool: [], page: 1, pageSize: 20, seed: 0 });
    expect(result.every((r) => !r.featured)).toBe(true);
    expect(result).toHaveLength(20);
  });
});
