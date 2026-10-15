import { createListingSchema, isPublicId } from '@ashian/shared';
import { describe, expect, it } from 'vitest';
import { generateDataset } from './generate.js';

const NOW = new Date('2026-10-06T08:00:00Z');
const data = generateDataset({ seed: 7, listingCount: 800, now: NOW });

describe('generateDataset', () => {
  it('قطعی است: seed یکسان، آگهی‌های یکسان', () => {
    const again = generateDataset({ seed: 7, listingCount: 800, now: NOW });
    const pick = (d: typeof data) =>
      d.listings.map((l) => [l.title, l.price, l.areaSqft, l.status]);
    expect(pick(again)).toEqual(pick(data));
  });

  it('همه‌ی آگهی‌ها از اسکیمای ثبت آگهی عبور می‌کنند', () => {
    const bad = data.listings
      .map((l) =>
        createListingSchema.safeParse({
          dealType: l.dealType,
          propertyType: l.propertyType,
          locationId: l.locationId,
          title: l.title,
          description: l.description,
          price: l.price,
          rentCheques: l.rentCheques,
          deposit: l.deposit,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          areaSqft: l.areaSqft,
          floor: l.floor,
          buildYear: l.buildYear,
          furnishing: l.furnishing,
          parkingSpaces: l.parkingSpaces,
          permitNumber: l.permitNumber,
        }),
      )
      .filter((r) => !r.success);
    expect(bad.map((b) => (b.success ? '' : b.error.issues[0]?.message))).toEqual([]);
  });

  it('شناسه‌های عمومی معتبر و یکتا هستند', () => {
    const ids = data.listings.map((l) => l.publicId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(isPublicId)).toBe(true);
  });

  it('یکپارچگی ارجاع‌ها', () => {
    const locationIds = new Set(data.locations.map((l) => l.id));
    const userIds = new Set(data.users.map((u) => u.id));
    const agentIds = new Set(data.agents.map((a) => a.id));
    for (const l of data.listings) {
      expect(locationIds.has(l.locationId)).toBe(true);
      expect(locationIds.has(l.communityId)).toBe(true);
      expect(userIds.has(l.ownerId)).toBe(true);
      if (l.agentId) expect(agentIds.has(l.agentId)).toBe(true);
    }
    const listingIds = new Set(data.listings.map((l) => l.id));
    expect(data.media.every((m) => listingIds.has(m.listingId))).toBe(true);
    expect(data.listingAmenities.every((a) => listingIds.has(a.listingId))).toBe(true);
  });

  it('وضعیت‌ها و تاریخ‌ها منطقی‌اند', () => {
    for (const l of data.listings) {
      if (l.status === 'active') {
        expect(l.publishedAt).not.toBeNull();
        expect(l.expiresAt!.getTime()).toBeGreaterThan(NOW.getTime());
      }
      if (l.status === 'expired') expect(l.expiresAt!.getTime()).toBeLessThan(NOW.getTime());
      if (l.status === 'draft' || l.status === 'pending_review') expect(l.publishedAt).toBeNull();
      if (l.status === 'rejected') expect(l.rejectionReason).toBeTruthy();
      expect(l.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it('توزیع قیمت واقع‌نماست (اجاره‌ی فعال، درهم در سال)', () => {
    const rent = (beds: number) =>
      data.listings
        .filter(
          (l) =>
            l.dealType === 'rent' &&
            l.status === 'active' &&
            l.bedrooms === beds &&
            l.propertyType === 'apartment',
        )
        .map((l) => l.price)
        .sort((a, b) => a - b);
    const median = (xs: number[]) => xs[Math.floor(xs.length / 2)]!;
    expect(median(rent(1))).toBeGreaterThan(55_000);
    expect(median(rent(1))).toBeLessThan(120_000);
    expect(median(rent(3))).toBeGreaterThan(median(rent(2)));
  });

  it('مختصات داخل دبی است', () => {
    for (const l of data.listings) {
      expect(l.lng).toBeGreaterThan(54.9);
      expect(l.lng).toBeLessThan(55.6);
      expect(l.lat).toBeGreaterThan(24.7);
      expect(l.lat).toBeLessThan(25.4);
    }
  });

  it('مشاور برتر فقط با امتیاز و نظر کافی', () => {
    for (const a of data.agents.filter((x) => x.isTopAgent)) {
      expect(a.rating).toBeGreaterThanOrEqual(4.7);
      expect(a.reviewCount).toBeGreaterThanOrEqual(30);
      expect(a.verificationStatus).toBe('verified');
    }
  });

  it('عنوان‌ها فارسی و بدون ارقام انگلیسی‌اند', () => {
    for (const l of data.listings.slice(0, 200)) expect(l.title).not.toMatch(/\d/);
  });
});
