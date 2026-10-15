import { randomUUID } from 'node:crypto';
import {
  LABELS,
  type AmenityCategory,
  bedroomsLabel,
  computeQualityScore,
  generatePublicId,
  slugify,
  toPersianDigits,
  type DealType,
  type Furnishing,
  type ListingStatus,
  type PropertyType,
  type UserRole,
} from '@ashian/shared';
import {
  AGENCIES,
  AMENITIES,
  COMMUNITIES,
  FIRST_NAMES,
  LAST_NAMES,
  PROPERTY_MIX,
  type CommunitySeed,
} from './data.js';
import { PHOTO_POOL, photosForCommunity } from './photos.js';
import { createRng, type Rng } from './rng.js';

/** تعداد عکس‌های seed (عکس واقعی از PHOTO_POOL؛ در نبود فایل‌ها SVG جای‌نگهدار) */
export const PLACEHOLDER_COUNT = PHOTO_POOL.length;

export interface LocationRow {
  id: string;
  parentId: string | null;
  type: 'emirate' | 'community' | 'tower';
  slug: string;
  nameFa: string;
  nameEn: string;
  aliases: string[];
  path: string;
  lng: number;
  lat: number;
}

export interface AmenityRow {
  id: number;
  slug: string;
  nameFa: string;
  nameEn: string;
  category: AmenityCategory;
  icon: string;
  sortOrder: number;
}

export interface UserRow {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
}

export interface AgencyRow {
  id: string;
  name: string;
  nameEn: string;
  slug: string;
  licenseNumber: string;
  verificationStatus: 'verified' | 'pending';
  description: string;
  /** کاربر مدیر آژانس */
  managerUserId: string;
}

export interface AgentRow {
  id: string;
  userId: string;
  agencyId: string | null;
  brn: string;
  bio: string;
  languages: string[];
  areaIds: string[];
  whatsapp: string;
  verificationStatus: 'verified' | 'pending' | 'rejected';
  rating: number | null;
  reviewCount: number;
  avgResponseMinutes: number;
  isTopAgent: boolean;
  activeListingCount: number;
}

export interface ListingRow {
  id: string;
  publicId: string;
  ownerId: string;
  agentId: string | null;
  dealType: DealType;
  propertyType: PropertyType;
  status: ListingStatus;
  tier: 'standard' | 'featured';
  isVerified: boolean;
  locationId: string;
  communityId: string;
  lng: number;
  lat: number;
  title: string;
  description: string;
  price: number;
  pricePerSqft: number;
  rentCheques: number[];
  deposit: number | null;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  floor: number | null;
  buildYear: number;
  furnishing: Furnishing;
  parkingSpaces: number;
  permitNumber: string | null;
  photoCount: number;
  qualityScore: number;
  publishedAt: Date | null;
  expiresAt: Date | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface Dataset {
  locations: LocationRow[];
  amenities: AmenityRow[];
  users: UserRow[];
  agencies: AgencyRow[];
  agents: AgentRow[];
  listings: ListingRow[];
  listingAmenities: Array<{ listingId: string; amenityId: number }>;
  media: Array<{ id: string; listingId: string; position: number; placeholder: number }>;
  priceHistory: Array<{ listingId: string; price: number; changedAt: Date }>;
}

const DAY = 86_400_000;
const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

const REJECTION_REASONS = [
  'عکس‌های ارسالی کیفیت کافی ندارند.',
  'شماره‌ی مجوز تبلیغ نامعتبر است.',
  'قیمت با مشخصات ملک هم‌خوانی ندارد.',
];

/* ───────────────────────── مکان‌ها ───────────────────────── */

function buildLocations(rng: Rng): {
  rows: LocationRow[];
  communities: Array<{ seed: CommunitySeed; row: LocationRow; towers: LocationRow[] }>;
} {
  const dubai: LocationRow = {
    id: randomUUID(),
    parentId: null,
    type: 'emirate',
    slug: 'dubai',
    nameFa: 'دبی',
    nameEn: 'Dubai',
    aliases: ['Dubai', 'دوبی'],
    path: 'dubai',
    lng: 55.2708,
    lat: 25.2048,
  };
  const rows: LocationRow[] = [dubai];
  const communities = COMMUNITIES.map((seed) => {
    const row: LocationRow = {
      id: randomUUID(),
      parentId: dubai.id,
      type: 'community',
      slug: seed.slug,
      nameFa: seed.fa,
      nameEn: seed.en,
      aliases: seed.aliases,
      path: `dubai/${seed.slug}`,
      lng: seed.lng,
      lat: seed.lat,
    };
    const towers = seed.towers.map(([en, fa]): LocationRow => {
      const slug = slugify(en);
      return {
        id: randomUUID(),
        parentId: row.id,
        type: 'tower',
        slug,
        nameFa: fa,
        nameEn: en,
        aliases: [en],
        path: `dubai/${seed.slug}/${slug}`,
        lng: +(seed.lng + rng.float(-0.004, 0.004)).toFixed(6),
        lat: +(seed.lat + rng.float(-0.003, 0.003)).toFixed(6),
      };
    });
    rows.push(row, ...towers);
    return { seed, row, towers };
  });
  return { rows, communities };
}

/* ───────────────────────── کاربران، آژانس‌ها، مشاوران ───────────────────────── */

function buildPeople(rng: Rng, communityIds: string[]) {
  const phoneUsed = new Set<string>();
  const phone = () => {
    for (;;) {
      const p = `97150${rng.int(1_000_000, 9_999_999)}`;
      if (!phoneUsed.has(p)) {
        phoneUsed.add(p);
        return p;
      }
    }
  };
  const person = () => {
    const [first, firstEn] = rng.pick(FIRST_NAMES);
    const [last, lastEn] = rng.pick(LAST_NAMES);
    return { name: `${first} ${last}`, nameEn: `${firstEn} ${lastEn}` };
  };

  const users: UserRow[] = [];
  const agencies: AgencyRow[] = AGENCIES.map((a, i) => {
    const managerUserId = randomUUID();
    users.push({ id: managerUserId, phone: phone(), name: person().name, role: 'agency_manager' });
    return {
    managerUserId,
    id: randomUUID(),
    name: a.fa,
    nameEn: a.en,
    slug: a.slug,
    licenseNumber: `ORN-${rng.int(10_000, 99_999)}`,
    verificationStatus: i < 7 ? 'verified' : 'pending',
    description: `${a.fa} با تمرکز بر اجاره و فروش ملک برای فارسی‌زبانان در دبی فعالیت می‌کند.`,
  };
  });

  const agents: AgentRow[] = [];

  for (let i = 0; i < 40; i++) {
    const p = person();
    const userId = randomUUID();
    users.push({ id: userId, phone: phone(), name: p.name, role: 'agent' });
    const reviews = rng.int(0, 160);
    const rating = reviews < 3 ? null : +rng.float(3.6, 5).toFixed(1);
    const verified = rng.chance(0.88);
    agents.push({
      id: randomUUID(),
      userId,
      agencyId: i < 35 ? agencies[i % agencies.length]!.id : null,
      brn: String(rng.int(10_000, 99_999)),
      bio: `مشاور املاک با ${toPersianDigits(rng.int(2, 14))} سال سابقه در بازار دبی. تسلط به فارسی، انگلیسی و عربی.`,
      languages: rng.sample(['fa', 'en', 'ar', 'ru'], rng.int(2, 3)).sort(),
      areaIds: rng.sample(communityIds, rng.int(2, 4)),
      whatsapp: users[users.length - 1]!.phone,
      verificationStatus: verified ? 'verified' : 'pending',
      rating,
      reviewCount: reviews,
      avgResponseMinutes: rng.int(4, 180),
      isTopAgent: verified && rating !== null && rating >= 4.7 && reviews >= 30,
      activeListingCount: 0,
    });
  }

  // مالک‌های خصوصی
  const owners: UserRow[] = [];
  for (let i = 0; i < 60; i++) {
    owners.push({ id: randomUUID(), phone: phone(), name: person().name, role: 'user' });
  }
  users.push(...owners);

  // یک ادمین برای ورود به پنل (مرحله ۱۲)
  users.push({ id: randomUUID(), phone: '971500000000', name: 'مدیر سیستم', role: 'admin' });

  return { users, agencies, agents, owners };
}

/* ───────────────────────── آگهی‌ها ───────────────────────── */

const FEATURE_SENTENCES = [
  'چیدمان باز و نورگیر با پنجره‌های بزرگ.',
  'آشپزخانه‌ی مدرن و مجهز به لوازم برقی.',
  'دسترسی آسان به ایستگاه مترو و مراکز خرید.',
  'ساختمان با امکانات رفاهی کامل و نگهبانی همیشگی.',
  'ملک در وضعیت عالی و آماده‌ی سکونت است.',
  'محله‌ای آرام و مناسب خانواده.',
  'پارکینگ اختصاصی در ساختمان.',
  'مدارس و درمانگاه در چند دقیقه‌ی پیاده‌روی.',
  'کفپوش و رنگ‌آمیزی تازه انجام شده است.',
  'بالکن بزرگ با منظره‌ی باز.',
];

function bedroomsFor(rng: Rng, type: PropertyType): number {
  switch (type) {
    case 'villa':
      return rng.weighted([
        [3, 20],
        [4, 36],
        [5, 28],
        [6, 12],
        [7, 4],
      ]);
    case 'townhouse':
      return rng.weighted([
        [2, 20],
        [3, 52],
        [4, 28],
      ]);
    case 'penthouse':
      return rng.weighted([
        [2, 20],
        [3, 35],
        [4, 30],
        [5, 15],
      ]);
    case 'duplex':
      return rng.weighted([
        [2, 30],
        [3, 45],
        [4, 25],
      ]);
    case 'hotel_apartment':
      return rng.weighted([
        [0, 45],
        [1, 40],
        [2, 15],
      ]);
    default:
      return rng.weighted([
        [0, 14],
        [1, 34],
        [2, 32],
        [3, 15],
        [4, 5],
      ]);
  }
}

function areaFor(rng: Rng, type: PropertyType, beds: number): number {
  const ranges: Record<PropertyType, (b: number) => [number, number]> = {
    apartment: (b) =>
      [
        [380, 550],
        [600, 950],
        [1000, 1600],
        [1500, 2400],
        [2400, 3800],
      ][Math.min(b, 4)] as [number, number],
    hotel_apartment: (b) => (b === 0 ? [330, 480] : b === 1 ? [550, 850] : [900, 1350]),
    townhouse: (b) => [1500 + b * 180, 2100 + b * 330],
    duplex: (b) => [1400 + b * 250, 2200 + b * 400],
    penthouse: (b) => [1800 + b * 450, 3000 + b * 800],
    villa: (b) => [2600 + b * 450, 4200 + b * 900],
  };
  const [lo, hi] = ranges[type](beds);
  return roundTo(rng.float(lo, hi), 5);
}

export function generateDataset(
  options: { seed?: number; listingCount?: number; now?: Date } = {},
): Dataset {
  const { seed = 20261006, listingCount = 5000, now = new Date() } = options;
  const rng = createRng(seed);

  const { rows: locationRows, communities } = buildLocations(rng);
  const amenities: AmenityRow[] = AMENITIES.map((a, i) => ({
    id: i + 1,
    slug: a.slug,
    nameFa: a.fa,
    nameEn: a.en,
    category: a.category,
    icon: a.icon,
    sortOrder: i,
  }));

  const { users, agencies, agents, owners } = buildPeople(
    rng,
    communities.map((c) => c.row.id),
  );
  const verifiedAgents = agents.filter((a) => a.verificationStatus === 'verified');

  const listings: ListingRow[] = [];
  const listingAmenities: Dataset['listingAmenities'] = [];
  const media: Dataset['media'] = [];
  const priceHistory: Dataset['priceHistory'] = [];
  const communityPick = communities.map((c) => [c, c.seed.weight] as const);

  for (let n = 0; n < listingCount; n++) {
    const { seed: cs, row: community, towers } = rng.weighted(communityPick);
    const tower = towers.length > 0 && rng.chance(0.55) ? rng.pick(towers) : null;
    const loc = tower ?? community;

    const propertyType = rng.weighted(PROPERTY_MIX[cs.villa ? 'villa' : 'urban']);
    const bedrooms = bedroomsFor(rng, propertyType);
    const bathrooms = Math.max(
      1,
      Math.min(bedrooms + (rng.chance(0.4) ? 1 : 0), bedrooms === 0 ? 1 : bedrooms + 1),
    );
    const areaSqft = areaFor(rng, propertyType, bedrooms);

    const dealType = rng.weighted<DealType>([
      ['rent', 66],
      ['sale', 28],
      ['short_term', 4],
      ['full_mortgage', 2],
    ]);
    const typeFactor = {
      apartment: 1,
      hotel_apartment: 1.1,
      townhouse: 0.9,
      duplex: 1.05,
      penthouse: 1.5,
      villa: 0.85,
    }[propertyType];
    const noise = rng.float(0.82, 1.22);
    const salePsf = 1100 * cs.mult * typeFactor * noise;
    const salePrice = roundTo(areaSqft * salePsf, 5000);
    // درهم به ازای هر فوت مربع در سال؛ میانگین بازار دبی حدود ۸۰ تا ۱۱۰
    const rentPsf = 98 * cs.mult * typeFactor * noise;
    const rentYearly = Math.max(roundTo(areaSqft * rentPsf, 1000), 32_000);

    let price: number;
    switch (dealType) {
      case 'sale':
        price = salePrice;
        break;
      case 'short_term':
        price = roundTo((rentYearly / 365) * rng.float(2.0, 2.8), 10);
        break;
      case 'full_mortgage':
        price = roundTo(rentYearly * 4.2, 5000);
        break;
      default:
        price = rentYearly;
    }
    const furnishing = rng.weighted<Furnishing>([
      ['unfurnished', 60],
      ['furnished', 25],
      ['semi_furnished', 15],
    ]);
    const isApartmentLike =
      propertyType === 'apartment' ||
      propertyType === 'penthouse' ||
      propertyType === 'hotel_apartment' ||
      propertyType === 'duplex';

    // وضعیت و تاریخ
    const status = rng.weighted<ListingStatus>([
      ['active', 90],
      ['pending_review', 5],
      ['draft', 2],
      ['rejected', 1.5],
      ['expired', 1.5],
    ]);
    // بیشتر آگهی‌های فعال تازه‌اند؛ فعال‌ها کمتر از ۶۰ روز دارند و منقضی‌ها بیشتر از ۶۰
    const ageDays =
      status === 'expired'
        ? rng.float(61, 120)
        : Math.pow(rng.next(), 1.8) * (status === 'active' ? 58 : 30);
    const createdAt = new Date(now.getTime() - (ageDays + rng.float(0, 1.5)) * DAY);
    const publishedAt =
      status === 'active' || status === 'expired' ? new Date(now.getTime() - ageDays * DAY) : null;
    const reviewed = status === 'active' || status === 'rejected' || status === 'expired';

    // مالک: مشاور (۸۵٪) یا شخص خصوصی
    const withAgent = rng.chance(0.85);
    let agent: AgentRow | null = null;
    if (withAgent) {
      const local = verifiedAgents.filter((a) => a.areaIds.includes(community.id));
      agent = rng.pick(local.length > 0 && rng.chance(0.8) ? local : verifiedAgents);
    }
    const ownerId = agent ? agent.userId : rng.pick(owners).id;

    const photoCount = status === 'draft' ? rng.int(0, 2) : rng.int(3, 9);
    const amenityPicks = AMENITIES.map((a, i) => ({ id: i + 1, p: a.p }))
      .filter((a) => rng.chance(a.p))
      .map((a) => a.id);

    const place = tower ? `${tower.nameFa}، ${community.nameFa}` : community.nameFa;
    const propFa = LABELS.propertyType[propertyType];
    const beds = bedroomsLabel(bedrooms);
    const base =
      bedrooms === 0 ? 'استودیو' : propertyType === 'apartment' ? beds : `${propFa} ${beds}`;
    const furn =
      furnishing === 'furnished' ? ' مبله' : furnishing === 'semi_furnished' ? ' نیمه‌مبله' : '';
    const suffix = {
      rent: '',
      sale: ' برای فروش',
      short_term: ' اجاره‌ی کوتاه‌مدت',
      full_mortgage: ' رهن کامل',
    }[dealType];
    const title = `${base}${furn}${suffix} در ${place}`;

    const cheques =
      dealType === 'rent' ? rng.sample([1, 2, 4, 6, 12], rng.int(1, 3)).sort((a, b) => a - b) : [];
    const dealSentence =
      dealType === 'rent'
        ? `اجاره‌ی سالانه با امکان پرداخت در ${cheques.map((c) => (c === 1 ? 'یک' : toPersianDigits(c))).join(' یا ')} چک.`
        : dealType === 'sale'
          ? 'مناسب سکونت و سرمایه‌گذاری؛ سند آماده‌ی انتقال.'
          : dealType === 'short_term'
            ? 'مناسب اقامت کوتاه‌مدت با قبض‌های شامل.'
            : 'رهن کامل بدون اجاره‌ی ماهانه.';
    const description = [
      `این ${propFa} ${beds} با ${toPersianDigits(areaSqft)} فوت مربع در ${place} قرار دارد.`,
      ...rng.sample(FEATURE_SENTENCES, rng.int(2, 4)),
      dealSentence,
    ].join(' ');

    const id = randomUUID();
    const isVerified = status === 'active' && rng.chance(0.6);
    const hasPermit = rng.chance(0.85);
    const row: ListingRow = {
      id,
      publicId: generatePublicId(),
      ownerId,
      agentId: agent?.id ?? null,
      dealType,
      propertyType,
      status,
      tier: status === 'active' && rng.chance(0.03) ? 'featured' : 'standard',
      isVerified,
      locationId: loc.id,
      communityId: community.id,
      lng: +(loc.lng + rng.float(-0.0008, 0.0008)).toFixed(6),
      lat: +(loc.lat + rng.float(-0.0006, 0.0006)).toFixed(6),
      title,
      description,
      price,
      pricePerSqft: Math.round(price / areaSqft),
      rentCheques: cheques,
      deposit: dealType === 'rent' ? roundTo(price * 0.05, 500) : null,
      bedrooms,
      bathrooms,
      areaSqft,
      floor: isApartmentLike ? rng.int(1, tower ? 45 : 14) : null,
      buildYear: rng.int(2005, 2025),
      furnishing,
      parkingSpaces: rng.weighted([
        [0, 12],
        [1, 50],
        [2, 30],
        [3, 8],
      ]),
      permitNumber: hasPermit ? String(rng.int(6_000_000_000, 7_999_999_999)) : null,
      photoCount,
      qualityScore: computeQualityScore({
        photoCount,
        descriptionLength: description.length,
        amenityCount: amenityPicks.length,
        hasPermit,
        hasFloor: isApartmentLike,
        isVerified,
      }),
      publishedAt,
      expiresAt: publishedAt ? new Date(publishedAt.getTime() + 60 * DAY) : null,
      reviewedAt: reviewed ? new Date(createdAt.getTime() + rng.float(0.1, 1) * DAY) : null,
      rejectionReason: status === 'rejected' ? rng.pick(REJECTION_REASONS) : null,
      createdAt,
    };
    listings.push(row);
    if (agent && status === 'active') agent.activeListingCount++;

    for (const amenityId of amenityPicks) listingAmenities.push({ listingId: id, amenityId });

    // عکس‌ها از گروه محله‌ی آگهی (دبی مارینا ← عکس مارینا) و پشت‌سرهم تا در یک آگهی تکرار نشوند
    const { indexes: pool, primary } = photosForCommunity(cs.slug, cs.villa === true);
    const firstPhoto = rng.int(0, primary - 1);
    for (let p = 0; p < photoCount; p++) {
      media.push({
        id: randomUUID(),
        listingId: id,
        position: p,
        placeholder: pool[(firstPhoto + p) % pool.length]!,
      });
    }

    // سابقه‌ی کاهش قیمت
    if (status === 'active' && rng.chance(0.12)) {
      const first = roundTo(price * rng.float(1.04, 1.12), 500);
      priceHistory.push({
        listingId: id,
        price: first,
        changedAt: new Date(createdAt.getTime() + 0.2 * DAY),
      });
      priceHistory.push({
        listingId: id,
        price,
        changedAt: new Date((publishedAt ?? createdAt).getTime() + rng.float(1, 6) * DAY),
      });
    }
  }

  return {
    locations: locationRows,
    amenities,
    users,
    agencies,
    agents,
    listings,
    listingAmenities,
    media,
    priceHistory,
  };
}
