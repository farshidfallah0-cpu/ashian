/**
 * تطبیق متن برای موتور درون‌حافظه (حالت lite). رفتار عمداً شبیه تنظیمات Typesense است:
 * پیشوند برای واژه‌ی آخر، غلط تایپی تا ۱ حرف برای واژه‌ی ۴ تا ۷ حرفی و ۲ حرف برای ۸ حرف به بالا.
 */

export const tokenize = (text: string): string[] => (text ? text.split(' ').filter(Boolean) : []);

/** فاصله‌ی ویرایشی با سقف؛ اگر از سقف بیشتر شد سقف+۱ برمی‌گرداند */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length]!;
}

export const allowedTypos = (length: number): number => (length >= 8 ? 2 : length >= 4 ? 1 : 0);

/**
 * کیفیت تطبیق یک واژه‌ی پرس‌وجو با یک واژه‌ی سند:
 * ۳ دقیق، ۲ پیشوند (فقط وقتی مجاز است)، ۱ غلط تایپی، ۰ نامرتبط.
 */
export function matchToken(query: string, candidate: string, allowPrefix: boolean): 0 | 1 | 2 | 3 {
  if (query === candidate) return 3;
  if (allowPrefix && candidate.startsWith(query)) return 2;
  const typos = allowedTypos(query.length);
  if (typos === 0) return 0;
  const target = allowPrefix ? candidate.slice(0, query.length) : candidate;
  if (boundedLevenshtein(query, candidate, typos) <= typos) return 1;
  if (allowPrefix && boundedLevenshtein(query, target, typos) <= typos) return 1;
  return 0;
}

/**
 * بهترین امتیاز تطبیق همه‌ی واژه‌های پرس‌وجو روی چند فیلد وزن‌دار.
 * هر واژه باید دست‌کم در یک فیلد بیاید وگرنه ۰ (سند نامرتبط).
 * اگر `minMatched` کمتر از تعداد واژه‌ها باشد، واژه‌های بی‌تطبیق (از آخر) رها می‌شوند.
 */
export function scoreTokens(
  queryTokens: readonly string[],
  fields: ReadonlyArray<{ weight: number; tokens: readonly string[] }>,
  minMatched = queryTokens.length,
): number {
  let total = 0;
  let matched = 0;
  for (const [index, token] of queryTokens.entries()) {
    const allowPrefix = index === queryTokens.length - 1;
    let best = 0;
    for (const field of fields) {
      for (const candidate of field.tokens) {
        const quality = matchToken(token, candidate, allowPrefix);
        if (quality > 0) best = Math.max(best, quality * field.weight);
      }
    }
    if (best > 0) {
      matched++;
      total += best;
    }
  }
  return matched >= minMatched ? total : 0;
}
