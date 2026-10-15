import { MAX_AGENT_RUN, MAX_FEATURED_PER_PAGE } from '@ashian/shared';

/* ───────────── امتیاز رتبه‌ی آگهی ───────────── */

export interface RankInput {
  qualityScore: number;
  photoCount: number;
  isVerified: boolean;
  isTopAgent: boolean;
  /** unix ثانیه */
  publishedAt: number;
  now: number;
}

/** آگهی با این شرایط «بی‌کیفیت» حساب می‌شود و امتیازش کم می‌شود */
export const LOW_QUALITY = { minScore: 45, minPhotos: 3 } as const;

/**
 * امتیاز رتبه‌ی ایندکس (۰ تا ۱۰۰۰)، فقط برای ترتیب «مرتبط‌ترین» و شکستن تساوی:
 * کیفیت اطلاعات، تأییدشدن، تازگی (در ۴۰ روز به صفر می‌رسد) و عکس.
 * آگهی قدیمی و بی‌کیفیت (عکس کم، اطلاعات ناقص) ضریب ۰٫۴ می‌گیرد.
 * تازگی در لحظه‌ی ایندکس محاسبه می‌شود؛ reindex شبانه آن را تازه نگه می‌دارد.
 */
export function computeRankScore(input: RankInput): number {
  const ageDays = Math.max(0, (input.now - input.publishedAt) / 86_400);
  const freshness = Math.max(0, 200 - ageDays * 5);
  let score = input.qualityScore * 6 + freshness;
  if (input.isVerified) score += 120;
  if (input.isTopAgent) score += 40;
  if (input.photoCount >= 8) score += 40;

  const lowQuality =
    input.qualityScore < LOW_QUALITY.minScore || input.photoCount < LOW_QUALITY.minPhotos;
  if (lowQuality) score *= 0.4;
  return Math.max(0, Math.min(1000, Math.round(score)));
}

/* ───────────── چینش منصفانه‌ی صفحه ───────────── */

export interface Rankable {
  id: string;
  /** خالی = بدون مشاور؛ محدودیت پشت‌سرهم روی آن اعمال نمی‌شود */
  agentId: string;
}

/** جایگاه‌های ثابت آگهی ویژه در هر صفحه (اندیس از صفر) */
export const FEATURED_SLOTS = [0, 4, 8] as const;

/** تعداد آگهی ویژه‌ی یک صفحه؛ فقط به اندازه‌ی صفحه و تعداد ویژه‌های موجود بستگی دارد (نه شماره‌ی صفحه) */
export function featuredPerPage(pageSize: number, featuredAvailable: number): number {
  const byPageSize = Math.floor(pageSize / 4);
  return Math.max(
    0,
    Math.min(MAX_FEATURED_PER_PAGE, FEATURED_SLOTS.length, byPageSize, featuredAvailable),
  );
}

/**
 * انتخاب ویژه‌های صفحه از استخر، به‌صورت چرخشی تا همه‌ی آگهی‌دهنده‌ها نوبت بگیرند.
 * `seed` بین صفحه‌ها و درخواست‌های یک بازه (مثلاً یک ساعت) ثابت است تا نتیجه پایدار بماند.
 * ویژه‌ی هم‌مشاور با یکدیگر کنار هم نمی‌نشینند مگر چاره‌ای نباشد (ترتیب انتخاب از «اولین با مشاور جدید» است).
 */
export function pickFeatured<T extends Rankable>(
  pool: readonly T[],
  count: number,
  page: number,
  seed: number,
  exclude: ReadonlySet<string> = new Set(),
): T[] {
  if (count <= 0 || pool.length === 0) return [];
  const start = (seed + (page - 1) * count) % pool.length;
  const picked: T[] = [];
  const usedAgents = new Set<string>();

  // دور اول: مشاورهای متفاوت؛ دور دوم: پر کردن باقی‌مانده
  for (const strict of [true, false]) {
    for (let i = 0; i < pool.length && picked.length < count; i++) {
      const item = pool[(start + i) % pool.length]!;
      if (exclude.has(item.id) || picked.includes(item)) continue;
      if (strict && item.agentId && usedAgents.has(item.agentId)) continue;
      picked.push(item);
      if (item.agentId) usedAgents.add(item.agentId);
    }
  }
  return picked;
}

function agentCounts(items: readonly Rankable[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { agentId } of items) if (agentId) counts.set(agentId, (counts.get(agentId) ?? 0) + 1);
  return counts;
}

/**
 * بعد از برداشتن یک آگهی از `taken`، آیا چینش بدون run طولانی هنوز ممکن است؟
 * اگر یک مشاور بیش از `maxRun * (بقیه + ۱)` آگهی باقی‌مانده داشته باشد، هر چینشی run می‌سازد؛
 * پس باید زودتر از آن مشاور برداشت.
 */
function stillFeasible(
  counts: ReadonlyMap<string, number>,
  totalAfter: number,
  taken: string,
  maxRun: number,
): boolean {
  for (const [agentId, count] of counts) {
    const after = agentId === taken ? count - 1 : count;
    if (after > maxRun * (totalAfter - after + 1)) return false;
  }
  return true;
}
/**
 * چینش یک صفحه:
 * ۱. ویژه‌ها در جایگاه‌های ثابت (اگر محتوای ارگانیک کافی نبود، پشت‌سر هم می‌آیند)
 * ۲. بقیه به ترتیب موتور؛ ولی هیچ مشاوری بیش از `maxRun` آگهی پشت‌سرهم ندارد.
 *    `carry` دو آگهی آخر صفحه‌ی قبل را می‌دهد تا مرز صفحه‌ها هم رعایت شود.
 *
 * ترتیب «ارگانیک» فقط داخل همین صفحه جابه‌جا می‌شود، پس عضویت آگهی‌ها در صفحه‌ها
 * (و نبود تکرار بین صفحه‌ها) تغییر نمی‌کند.
 */
export function arrangePage<T extends Rankable>(
  organic: readonly T[],
  featured: readonly T[],
  carry: readonly string[] = [],
  maxRun: number = MAX_AGENT_RUN,
): T[] {
  const remaining = [...organic];
  const result: Array<T | undefined> = [];
  const slots = FEATURED_SLOTS.slice(0, featured.length);
  const tail = [...carry];

  const violates = (agentId: string): boolean => {
    if (!agentId || tail.length < maxRun) return false;
    return tail.slice(-maxRun).every((a) => a === agentId);
  };
  const place = (item: T) => {
    result.push(item);
    tail.push(item.agentId || `__solo:${item.id}`);
  };

  const total = organic.length + featured.length;
  let nextFeatured = 0;
  while (result.length < total) {
    const position = result.length;
    const slotIndex = slots.indexOf(position as (typeof FEATURED_SLOTS)[number]);
    if (slotIndex >= 0 && nextFeatured < featured.length && remaining.length > 0) {
      // ویژه فقط وقتی ارگانیک برایش جا باز کرده باشد در جایگاه ثابت می‌نشیند
      place(featured[nextFeatured++]!);
      continue;
    }
    if (remaining.length === 0) {
      if (nextFeatured < featured.length) place(featured[nextFeatured++]!);
      continue;
    }
    // اولین آگهی‌ای که run را نمی‌شکند و بقیه را هم «بن‌بست» نمی‌کند؛ وگرنه اولین بی‌خطا؛ وگرنه ترتیب اصلی
    const counts = agentCounts(remaining);
    let index = remaining.findIndex(
      (item) =>
        !violates(item.agentId) &&
        stillFeasible(counts, remaining.length - 1, item.agentId, maxRun),
    );
    if (index === -1) index = remaining.findIndex((item) => !violates(item.agentId));
    place(remaining.splice(index === -1 ? 0 : index, 1)[0]!);
  }
  return result as T[];
}

/**
 * چینش صفحه‌ی `page` با شبیه‌سازی صفحه‌های قبلی. همه‌ی کار روی آرایه‌ی سبک (id و مشاور)
 * در حافظه است و ارزان.
 *
 * - هر آگهی فقط یک بار در کل صفحه‌ها می‌آید: ویژه‌ای که در جایگاه ثابت نشست، از جریان عادی حذف می‌شود.
 * - هر صفحه دقیقاً `pageSize` آگهی دارد (ویژه‌ها + بقیه از جریان عادی).
 * - مرز صفحه‌ها در قانون «حداکثر ۲ آگهی پشت‌سرهم از یک مشاور» حساب می‌شود.
 *
 * `organic`: همه‌ی نتایج به ترتیب موتور، `featuredPool`: استخر ویژه‌ها.
 */
export function composePage<T extends Rankable>(options: {
  organic: readonly T[];
  featuredPool: readonly T[];
  page: number;
  pageSize: number;
  seed: number;
}): Array<{ item: T; featured: boolean }> {
  const { organic, featuredPool, page, pageSize, seed } = options;
  const slots = featuredPerPage(pageSize, featuredPool.length);

  const shown = new Set<string>();
  let cursor = 0;
  let carry: string[] = [];
  let arranged: T[] = [];
  let featuredIds = new Set<string>();

  for (let p = 1; p <= page; p++) {
    const picks = pickFeatured(featuredPool, slots, p, seed, shown);
    for (const pick of picks) shown.add(pick.id);

    const slice: T[] = [];
    while (cursor < organic.length && slice.length < pageSize - picks.length) {
      const item = organic[cursor++]!;
      if (shown.has(item.id)) continue;
      shown.add(item.id);
      slice.push(item);
    }

    arranged = arrangePage(slice, picks, carry);
    featuredIds = new Set(picks.map((i) => i.id));
    carry = arranged.slice(-MAX_AGENT_RUN).map((i) => i.agentId || `__solo:${i.id}`);
  }
  return arranged.map((item) => ({ item, featured: featuredIds.has(item.id) }));
}
