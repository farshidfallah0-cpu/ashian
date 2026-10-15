import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateDataset } from './generate.js';
import { PHOTO_POOL, photosForCommunity } from './photos.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'photos');

describe('عکس‌های seed', () => {
  it('برای هر عکس فایل و منبع/مجوز ثبت شده است', () => {
    const credits = JSON.parse(readFileSync(join(DIR, 'CREDITS.json'), 'utf8')) as Array<{
      key: string;
      license: string;
      page: string;
    }>;
    for (const { key } of PHOTO_POOL) {
      expect(existsSync(join(DIR, `${key}.jpg`)), `${key}.jpg`).toBe(true);
      const credit = credits.find((c) => c.key === key);
      expect(credit, `credit ${key}`).toBeTruthy();
      // فقط مجوزهایی که بدون شرط اضافی قابل استفاده‌اند
      expect(credit!.license).toMatch(/^(CC0|Public domain)/i);
      expect(credit!.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it('کاور هر آگهی از گروه محله‌ی خودش است و عکس‌های یک آگهی تکراری نیستند', () => {
    const data = generateDataset({ seed: 3, listingCount: 300, now: new Date('2026-10-06') });
    const slugOf = new Map(data.locations.map((l) => [l.id, l.slug]));
    const communityOf = new Map(data.listings.map((l) => [l.id, l.communityId]));
    const villaSlugs = new Set(
      data.locations
        .filter((l) => photosForCommunity(l.slug, true).primary < 12)
        .map((l) => l.slug),
    );
    const byListing = new Map<string, number[]>();
    for (const m of [...data.media].sort((a, b) => a.position - b.position)) {
      byListing.set(m.listingId, [...(byListing.get(m.listingId) ?? []), m.placeholder]);
    }

    for (const [listingId, photos] of byListing) {
      const slug = slugOf.get(communityOf.get(listingId)!)!;
      expect(new Set(photos).size).toBe(photos.length);
      const cover = photos[0]!;
      const own = [false, true].flatMap((villa) => {
        const { indexes, primary } = photosForCommunity(slug, villa);
        return indexes.slice(0, primary);
      });
      expect(own, slug).toContain(cover);
    }
    expect(villaSlugs.size).toBeGreaterThan(0);
  });

  it('مارینا فقط عکس مارینا می‌گیرد', () => {
    const { indexes, primary } = photosForCommunity('dubai-marina', false);
    const groups = new Set(indexes.slice(0, primary).map((i) => PHOTO_POOL[i]!.group));
    expect([...groups]).toEqual(['marina']);
  });
});
