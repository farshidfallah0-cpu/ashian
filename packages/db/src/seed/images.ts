import { createRng } from './rng.js';

const BACKGROUNDS = ['#F0EEE9', '#EAE6DE', '#E9EDF3', '#F6EBDD', '#E4EAE6', '#EFE9E4'];
const GROUNDS = ['#DDD8CE', '#D6D1C6', '#D5DCE6', '#E8D6BF', '#CBD6CF', '#DDD2C8'];
const NAVY = '#1B2B4B';

/**
 * عکس جای‌نگهدار: خط افق ساختمان‌ها با پالت برند (سرمه‌ای + یک نقطه‌ی زعفرانی).
 * عمداً «تصویرسازی» است تا در محیط توسعه با عکس واقعی اشتباه گرفته نشود؛
 * هر کدام ترکیب متفاوتی دارند تا لیست‌ها یکنواخت نشوند.
 */
export function placeholderSvg(index: number): string {
  const rng = createRng(1000 + index * 77);
  const W = 1600;
  const H = 1200;
  const bg = BACKGROUNDS[index % BACKGROUNDS.length]!;
  const ground = GROUNDS[index % GROUNDS.length]!;
  const horizon = 960;

  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${bg}"/>`];

  // خورشید یا ماه
  const sunX = rng.int(220, 1380);
  parts.push(
    index % 3 === 0
      ? `<circle cx="${sunX}" cy="${rng.int(210, 360)}" r="${rng.int(70, 110)}" fill="#D97B29" opacity="0.92"/>`
      : `<circle cx="${sunX}" cy="${rng.int(200, 340)}" r="${rng.int(60, 90)}" fill="#FFFFFF" opacity="0.7"/>`,
  );

  // ساختمان‌های دورتر کم‌رنگ، نزدیک‌ها پررنگ
  const layers: Array<{ count: number; opacity: number; minH: number; maxH: number }> = [
    { count: rng.int(6, 9), opacity: 0.22, minH: 260, maxH: 560 },
    { count: rng.int(4, 6), opacity: 0.9, minH: 420, maxH: 780 },
  ];
  for (const layer of layers) {
    const slot = W / layer.count;
    for (let i = 0; i < layer.count; i++) {
      const w = rng.int(Math.floor(slot * 0.55), Math.floor(slot * 0.95));
      const x = Math.round(i * slot + rng.int(0, Math.max(1, Math.floor(slot - w))));
      const h = rng.int(layer.minH, layer.maxH);
      const y = horizon - h;
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${NAVY}" opacity="${layer.opacity}"/>`,
      );
      if (layer.opacity > 0.5) {
        // پنجره‌ها
        const cols = Math.max(2, Math.floor(w / 46));
        const rows = Math.floor((h - 50) / 56);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lit = rng.chance(0.07);
            const wx = x + 22 + c * ((w - 44) / cols);
            parts.push(
              `<rect x="${wx.toFixed(0)}" y="${y + 28 + r * 56}" width="22" height="30" fill="${lit ? '#D97B29' : '#F7F6F3'}" opacity="${lit ? 0.95 : 0.55}"/>`,
            );
          }
        }
      }
    }
  }

  parts.push(`<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${ground}"/>`);
  parts.push(`<rect y="${horizon}" width="${W}" height="3" fill="${NAVY}" opacity="0.35"/>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`;
}
