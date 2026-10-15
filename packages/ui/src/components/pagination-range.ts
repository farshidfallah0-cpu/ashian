export type PageItem = number | 'gap';

/**
 * شماره‌ی صفحه‌هایی که نمایش داده می‌شوند. همیشه اول و آخر، و اطراف صفحه‌ی فعلی.
 * مثال: [1, 'gap', 4, 5, 6, 'gap', 12]
 */
export function getPageRange(current: number, total: number, siblings = 1): PageItem[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const page = Math.min(Math.max(1, current), total);

  // اگر همه جا می‌شوند، gap لازم نیست
  const maxVisible = siblings * 2 + 5;
  if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);

  const left = Math.max(page - siblings, 2);
  const right = Math.min(page + siblings, total - 1);
  const items: PageItem[] = [1];

  if (left > 2) items.push(left === 3 ? 2 : 'gap');
  for (let p = left; p <= right; p++) items.push(p);
  if (right < total - 1) items.push(right === total - 2 ? total - 1 : 'gap');

  items.push(total);
  return items;
}
