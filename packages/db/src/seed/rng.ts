/** مولد عدد تصادفی قطعی (mulberry32)؛ با seed یکسان همیشه همان داده تولید می‌شود. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** عدد صحیح در [min, max] */
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number) => next() * (max - min) + min,
    chance: (p: number) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    /** انتخاب وزنی از [مقدار، وزن] */
    weighted: <T>(items: ReadonlyArray<readonly [T, number]>): T => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [value, weight] of items) {
        r -= weight;
        if (r <= 0) return value;
      }
      return items[items.length - 1]![0];
    },
    /** n عضو متمایز */
    sample: <T>(items: readonly T[], n: number): T[] => {
      const copy = [...items];
      const out: T[] = [];
      while (out.length < n && copy.length) {
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]!);
      }
      return out;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;
