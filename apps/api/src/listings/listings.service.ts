import { createHash } from 'node:crypto';
import type { DbClient } from '@ashian/db';
import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  latOf,
  lngOf,
  point,
  schema,
} from '@ashian/db';
import type { Cache, QueueClient } from '@ashian/infra';
import {
  computeQualityScore,
  createListingSchema,
  detectQualityWarnings,
  validateListingPartial,
  generatePublicId,
  type CreateListingInput,
  type ListingStatus,
  type UpdateListingInput,
} from '@ashian/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { toPage, type Page } from '../common/pipes.js';
import { CACHE, DB, QUEUE } from '../infra/tokens.js';
import { LocationsService } from '../locations/locations.service.js';
import { ListingChecksService } from './listing-checks.service.js';
import { cardQuery, toCard, type ListingCard } from './listing-card.js';

const {
  listings,
  listingAmenities,
  listingMedia,
  amenities,
  priceHistory,
  agents,
  users,
  agencies,
  locations,
} = schema;

const MIN_PHOTOS_TO_SUBMIT = 3;
/** عمر یک آگهی پس از تأیید یا تمدید */
const LISTING_LIFETIME_DAYS = 30;
const MAX_DRAFTS_PER_USER = 30;
const PUBLIC_CACHE_TTL = 30;

const placeLoc = alias(locations, 'place_loc');
const communityLoc = alias(locations, 'community_loc');

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === '23505';
const cacheKey = (publicId: string) => `listing:${publicId}`;

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(QUEUE) private readonly queue: QueueClient,
    private readonly locationsService: LocationsService,
    private readonly checks: ListingChecksService,
  ) {}

  /* ───────────── خواندن ───────────── */

  /**
   * جزئیات آگهی. بازدیدکننده‌ی ناشناس پاسخ کش‌شده می‌گیرد (۳۰ ثانیه)؛
   * کاربر واردشده پاسخ تازه با قاعده‌ی دسترسی (مالک و ادمین پیش‌نویس خود را می‌بینند).
   */
  async getDetail(publicId: string, viewer?: AuthUser) {
    let detail: Awaited<ReturnType<ListingsService['loadDetail']>>;
    if (!viewer) {
      detail = await this.cache.wrap(cacheKey(publicId), PUBLIC_CACHE_TTL, () =>
        this.loadDetail(publicId, undefined),
      );
    } else {
      detail = await this.loadDetail(publicId, viewer);
    }
    if (!detail) throw new NotFoundException('آگهی پیدا نشد');

    const isFavorite = viewer
      ? (
          await this.db.primary
            .select({ n: count() })
            .from(schema.favorites)
            .where(
              and(
                eq(schema.favorites.userId, viewer.id),
                eq(schema.favorites.listingId, detail.id),
              ),
            )
        )[0]!.n > 0
      : false;

    const { id: _internal, ownerId: _owner, ...publicDetail } = detail;
    return { ...publicDetail, isFavorite, isOwner: viewer?.id === detail.ownerId };
  }

  private async loadDetail(publicId: string, viewer: AuthUser | undefined) {
    const db = viewer ? this.db.primary : this.db.replica;
    const [row] = await db
      .select({
        listing: listings,
        lng: lngOf(listings.location),
        lat: latOf(listings.location),
        place: {
          id: placeLoc.id,
          type: placeLoc.type,
          slug: placeLoc.slug,
          nameFa: placeLoc.nameFa,
          nameEn: placeLoc.nameEn,
        },
        community: {
          id: communityLoc.id,
          path: communityLoc.path,
          slug: communityLoc.slug,
          nameFa: communityLoc.nameFa,
          nameEn: communityLoc.nameEn,
        },
        agent: {
          id: agents.id,
          name: users.name,
          avatarKey: users.avatarKey,
          languages: agents.languages,
          rating: agents.rating,
          reviewCount: agents.reviewCount,
          avgResponseMinutes: agents.avgResponseMinutes,
          isTopAgent: agents.isTopAgent,
          verification: agents.verificationStatus,
          activeListingCount: agents.activeListingCount,
          agencyId: agencies.id,
          agencyName: agencies.name,
          agencySlug: agencies.slug,
          agencyLogo: agencies.logoKey,
        },
      })
      .from(listings)
      .innerJoin(placeLoc, eq(placeLoc.id, listings.locationId))
      .innerJoin(communityLoc, eq(communityLoc.id, listings.communityId))
      .leftJoin(agents, eq(agents.id, listings.agentId))
      .leftJoin(users, eq(users.id, agents.userId))
      .leftJoin(agencies, eq(agencies.id, agents.agencyId))
      .where(and(eq(listings.publicId, publicId), isNull(listings.deletedAt)))
      .limit(1);
    if (!row) return null;

    const l = row.listing;
    const privileged = viewer && (viewer.id === l.ownerId || viewer.role === 'admin');
    if (l.status !== 'active' && !privileged) return null;

    const [media, amenityRows, history] = await Promise.all([
      db
        .select({
          id: listingMedia.id,
          kind: listingMedia.kind,
          position: listingMedia.position,
          status: listingMedia.status,
          width: listingMedia.width,
          height: listingMedia.height,
          blurhash: listingMedia.blurhash,
          variants: listingMedia.variants,
          originalKey: listingMedia.originalKey,
        })
        .from(listingMedia)
        .where(
          and(
            eq(listingMedia.listingId, l.id),
            privileged ? undefined : eq(listingMedia.status, 'ready'),
          ),
        )
        .orderBy(asc(listingMedia.position)),
      db
        .select({
          id: amenities.id,
          slug: amenities.slug,
          nameFa: amenities.nameFa,
          category: amenities.category,
          icon: amenities.icon,
        })
        .from(listingAmenities)
        .innerJoin(amenities, eq(amenities.id, listingAmenities.amenityId))
        .where(eq(listingAmenities.listingId, l.id))
        .orderBy(asc(amenities.sortOrder)),
      db
        .select({ price: priceHistory.price, changedAt: priceHistory.changedAt })
        .from(priceHistory)
        .where(eq(priceHistory.listingId, l.id))
        .orderBy(asc(priceHistory.changedAt)),
    ]);

    const a = row.agent;
    return {
      id: l.id,
      ownerId: l.ownerId,
      publicId: l.publicId,
      code: l.code,
      dealType: l.dealType,
      propertyType: l.propertyType,
      status: l.status,
      tier: l.tier,
      isVerified: l.isVerified,
      title: l.title,
      description: l.description,
      price: l.price,
      pricePerSqft: l.pricePerSqft,
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
      qualityScore: privileged ? l.qualityScore : undefined,
      rejectionReason: privileged ? l.rejectionReason : undefined,
      coordinates: { lng: row.lng, lat: row.lat },
      place: row.place,
      community: row.community,
      // کلید فایل اصلی فقط برای ویدیو و تور ۳۶۰ لازم است (عکس‌ها از variants خوانده می‌شوند)
      media: media.map(({ originalKey, ...m }) => ({
        ...m,
        source: m.kind === 'video' || m.kind === 'tour360' ? originalKey : null,
      })),
      amenities: amenityRows,
      priceHistory: history,
      agent: a?.id
        ? {
            id: a.id,
            name: a.name ?? 'مشاور',
            avatarKey: a.avatarKey,
            languages: a.languages ?? [],
            rating: a.rating,
            reviewCount: a.reviewCount ?? 0,
            avgResponseMinutes: a.avgResponseMinutes,
            isTopAgent: a.isTopAgent ?? false,
            isVerified: a.verification === 'verified',
            activeListingCount: a.activeListingCount ?? 0,
            agency: a.agencyId
              ? { id: a.agencyId, name: a.agencyName!, slug: a.agencySlug!, logoKey: a.agencyLogo }
              : null,
          }
        : null,
      publishedAt: l.publishedAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      expiresAt: l.expiresAt,
    };
  }

  /**
   * شمارش بازدید از طریق صف؛ هیچ نوشتن مستقیمی روی دیتابیس انجام نمی‌شود.
   * صفحه‌ی آگهی ISR است و سرور Next هیچ‌وقت IP بازدیدکننده را نمی‌بیند، پس مرورگر خودش بعد از
   * نمایش صفحه این مسیر را صدا می‌زند (POST /listings/:publicId/view) تا بازدید یکتا درست شمرده شود.
   */
  async recordView(publicId: string, visit: { ip: string; userAgent: string }) {
    try {
      const listingId = await this.cache.wrap(`listing-id:${publicId}`, 600, () =>
        this.idByPublicId(publicId),
      );
      const day = new Date().toISOString().slice(0, 10);
      // هش روزانه: بازدیدکننده‌ی یکتا شمرده می‌شود بدون ذخیره‌ی IP
      const visitorHash = createHash('sha256')
        .update(`${visit.ip}|${visit.userAgent}|${day}|${this.env.MEDIA_SIGNING_SECRET}`)
        .digest('hex')
        .slice(0, 16);
      await this.queue.enqueue(
        'analytics.view',
        { listingId, day, visitorHash },
        { attempts: 2, removeOnComplete: true },
      );
    } catch {
      /* شکست شمارش بازدید نباید صفحه را خراب کند */
    }
  }

  async mine(
    user: AuthUser,
    opts: { status?: ListingStatus; page: number; pageSize: number },
  ): Promise<Page<ListingCard>> {
    const where = and(
      eq(listings.ownerId, user.id),
      isNull(listings.deletedAt),
      opts.status ? eq(listings.status, opts.status) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      cardQuery(this.db.primary)
        .where(where)
        .orderBy(desc(listings.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
      this.db.primary.select({ n: count() }).from(listings).where(where),
    ]);
    return toPage(rows.map(toCard), total?.n ?? 0, opts.page, opts.pageSize);
  }

  /* ───────────── نوشتن ───────────── */

  async create(user: AuthUser, input: CreateListingInput) {
    const place = await this.locationsService.resolveCommunity(input.locationId);
    if (!place) throw new BadRequestException('مکان انتخاب‌شده نامعتبر است');

    const [{ n: drafts } = { n: 0 }] = await this.db.primary
      .select({ n: count() })
      .from(listings)
      .where(
        and(
          eq(listings.ownerId, user.id),
          eq(listings.status, 'draft'),
          isNull(listings.deletedAt),
        ),
      );
    if (drafts >= MAX_DRAFTS_PER_USER)
      throw new ConflictException('تعداد پیش‌نویس‌های شما به حد مجاز رسیده است');

    const amenityIds = await this.validAmenityIds(input.amenityIds);
    // هر کاربری که ثبت‌نام مشاور کرده باشد، آگهی‌اش به پروفایل مشاورش وصل می‌شود
    const agentId = await this.agentIdOf(user.id);
    const lng = input.lng ?? place.lng;
    const lat = input.lat ?? place.lat;

    // شناسه‌ی عمومی تصادفی؛ در تصادف نادر (unique) دوباره تلاش می‌کنیم
    for (let attempt = 0; attempt < 5; attempt++) {
      const publicId = generatePublicId();
      try {
        const created = await this.db.primary.transaction(async (tx) => {
          const [row] = await tx
            .insert(listings)
            .values({
              publicId,
              ownerId: user.id,
              agentId,
              dealType: input.dealType,
              propertyType: input.propertyType,
              status: 'draft',
              locationId: place.locationId,
              communityId: place.communityId,
              location: point(lng, lat),
              title: input.title,
              description: input.description,
              price: input.price,
              pricePerSqft: Math.round(input.price / input.areaSqft),
              rentCheques: input.rentCheques,
              deposit: input.deposit,
              bedrooms: input.bedrooms,
              bathrooms: input.bathrooms,
              areaSqft: input.areaSqft,
              floor: input.floor,
              buildYear: input.buildYear,
              furnishing: input.furnishing,
              parkingSpaces: input.parkingSpaces,
              permitNumber: input.permitNumber,
              qualityScore: computeQualityScore({
                photoCount: 0,
                descriptionLength: input.description.length,
                amenityCount: amenityIds.length,
                hasPermit: !!input.permitNumber,
                hasFloor: input.floor !== null,
              }),
            })
            .returning({ id: listings.id, publicId: listings.publicId, code: listings.code });
          if (amenityIds.length) {
            await tx
              .insert(listingAmenities)
              .values(amenityIds.map((amenityId) => ({ listingId: row!.id, amenityId })));
          }
          return row!;
        });

        const avg = await this.locationsService.avgSalePricePerSqft(place.communityId);
        return {
          ...created,
          status: 'draft' as const,
          warnings: detectQualityWarnings(input, avg),
        };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new ConflictException('ساخت آگهی ناموفق بود؛ دوباره تلاش کنید');
  }

  async update(user: AuthUser, publicId: string, patch: UpdateListingInput) {
    const existing = await this.ownedListing(user, publicId);
    const currentAmenities = await this.db.primary
      .select({ id: listingAmenities.amenityId })
      .from(listingAmenities)
      .where(eq(listingAmenities.listingId, existing.id));

    // ترکیب با مقدار فعلی و اعتبارسنجی دوباره‌ی کل آگهی (قواعد بین‌فیلدی)
    const [coords] = await this.db.primary
      .select({ lng: lngOf(listings.location), lat: latOf(listings.location) })
      .from(listings)
      .where(eq(listings.id, existing.id));
    const merged = createListingSchema.safeParse({
      dealType: existing.dealType,
      propertyType: existing.propertyType,
      locationId: existing.locationId,
      title: existing.title,
      description: existing.description,
      price: existing.price,
      rentCheques: existing.rentCheques,
      deposit: existing.deposit,
      bedrooms: existing.bedrooms,
      bathrooms: existing.bathrooms,
      areaSqft: existing.areaSqft,
      floor: existing.floor,
      buildYear: existing.buildYear,
      furnishing: existing.furnishing,
      parkingSpaces: existing.parkingSpaces,
      permitNumber: existing.permitNumber,
      amenityIds: currentAmenities.map((a) => a.id),
      lng: coords?.lng ?? null,
      lat: coords?.lat ?? null,
      ...patch,
    });
    if (!merged.success) {
      throw new BadRequestException({
        message: 'ورودی نامعتبر است',
        errors: merged.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const next = merged.data;

    let place = {
      locationId: existing.locationId,
      communityId: existing.communityId,
      lng: next.lng ?? 0,
      lat: next.lat ?? 0,
    };
    if (patch.locationId && patch.locationId !== existing.locationId) {
      const resolved = await this.locationsService.resolveCommunity(patch.locationId);
      if (!resolved) throw new BadRequestException('مکان انتخاب‌شده نامعتبر است');
      place = { ...resolved, lng: patch.lng ?? resolved.lng, lat: patch.lat ?? resolved.lat };
    }
    const amenityIds = patch.amenityIds ? await this.validAmenityIds(next.amenityIds) : null;

    await this.db.primary.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({
          dealType: next.dealType,
          propertyType: next.propertyType,
          locationId: place.locationId,
          communityId: place.communityId,
          location: point(next.lng ?? place.lng, next.lat ?? place.lat),
          title: next.title,
          description: next.description,
          price: next.price,
          pricePerSqft: Math.round(next.price / next.areaSqft),
          rentCheques: next.rentCheques,
          deposit: next.deposit,
          bedrooms: next.bedrooms,
          bathrooms: next.bathrooms,
          areaSqft: next.areaSqft,
          floor: next.floor,
          buildYear: next.buildYear,
          furnishing: next.furnishing,
          parkingSpaces: next.parkingSpaces,
          permitNumber: next.permitNumber,
          qualityScore: computeQualityScore({
            photoCount: existing.photoCount,
            descriptionLength: next.description.length,
            amenityCount: amenityIds?.length ?? currentAmenities.length,
            hasPermit: !!next.permitNumber,
            hasFloor: next.floor !== null,
            isVerified: existing.isVerified,
          }),
        })
        .where(eq(listings.id, existing.id));

      if (amenityIds) {
        await tx.delete(listingAmenities).where(eq(listingAmenities.listingId, existing.id));
        if (amenityIds.length) {
          await tx
            .insert(listingAmenities)
            .values(amenityIds.map((amenityId) => ({ listingId: existing.id, amenityId })));
        }
      }
      // تغییر قیمت آگهی فعال در تاریخچه ثبت می‌شود
      if (existing.status === 'active' && next.price !== existing.price) {
        await tx.insert(priceHistory).values({ listingId: existing.id, price: next.price });
      }
    });

    await this.cache.del(cacheKey(publicId));
    if (existing.status === 'active') await this.requestSearchSync(existing.id);
    const avg = await this.locationsService.avgSalePricePerSqft(place.communityId);
    return { publicId, warnings: detectQualityWarnings(next, avg) };
  }

  /** ارسال برای بررسی: حداقل ۳ عکس آماده لازم است */
  /** اعتبارسنجی مرحله‌ای ویزارد؛ میانگین قیمت محله (در صورت انتخاب مکان) به هشدار قیمت کمک می‌کند */
  async validatePartial(input: Record<string, unknown>) {
    let avg: number | undefined;
    if (typeof input.locationId === 'string') {
      const place = await this.locationsService.resolveCommunity(input.locationId).catch(() => null);
      if (place) avg = await this.locationsService.avgSalePricePerSqft(place.communityId);
    }
    return validateListingPartial(input, avg);
  }

  /** پیش‌نمایش ارسال: هشدار داده‌ی غیرعادی، آگهی‌های تکراری و وضعیت عکس‌ها */
  async review(user: AuthUser, publicId: string) {
    const existing = await this.ownedListing(user, publicId);
    return this.checks.review(existing.id);
  }

  async submit(user: AuthUser, publicId: string, confirm = false) {
    const existing = await this.ownedListing(user, publicId);
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      throw new ConflictException('فقط پیش‌نویس یا آگهی ردشده قابل ارسال است');
    }
    const [{ n: photos } = { n: 0 }] = await this.db.primary
      .select({ n: count() })
      .from(listingMedia)
      .where(
        and(
          eq(listingMedia.listingId, existing.id),
          eq(listingMedia.status, 'ready'),
          eq(listingMedia.kind, 'image'),
        ),
      );
    if (photos < MIN_PHOTOS_TO_SUBMIT) {
      throw new UnprocessableEntityException(
        `حداقل ${MIN_PHOTOS_TO_SUBMIT} عکس لازم است (آماده: ${photos})`,
      );
    }
    const review = await this.checks.review(existing.id);
    if (review.photos.processing > 0) {
      throw new ConflictException('عکس‌ها هنوز در حال پردازش‌اند؛ چند ثانیه بعد دوباره امتحان کنید');
    }
    // داده‌ی غیرعادی و آگهی تکراری مانع نیستند ولی کاربر باید صریحاً تأیید کند
    if (!confirm && (review.warnings.length > 0 || review.duplicates.length > 0)) {
      throw new ConflictException({
        message: 'پیش از ارسال، هشدارها را اصلاح یا تأیید کنید',
        code: 'needs_confirmation',
        warnings: review.warnings,
        duplicates: review.duplicates,
      });
    }
    await this.db.primary
      .update(listings)
      .set({ status: 'pending_review', rejectionReason: null, photoCount: photos })
      .where(eq(listings.id, existing.id));
    await this.cache.del(cacheKey(publicId));
    return { publicId, status: 'pending_review' as const };
  }

  /* ───────────── مدیریت چرخه‌ی عمر (پنل مشاور) ───────────── */

  /**
   * تمدید برای ۳۰ روز دیگر. آگهی فعال همان‌طور فعال می‌ماند؛ آگهی منقضی‌شده یا متوقف فقط اگر قبلاً
   * تأیید شده باشد دوباره فعال می‌شود (وگرنه برای بررسی می‌رود تا تمدید راه دور زدن تأیید نشود).
   */
  async renew(user: AuthUser, publicId: string) {
    const existing = await this.ownedListing(user, publicId);
    if (existing.status !== 'active' && existing.status !== 'expired' && existing.status !== 'paused') {
      throw new ConflictException('فقط آگهی فعال، متوقف یا منقضی قابل تمدید است');
    }
    const status: ListingStatus =
      existing.status === 'active' ? 'active' : existing.reviewedAt ? 'active' : 'pending_review';
    await this.db.primary
      .update(listings)
      .set({
        status,
        expiresAt: new Date(Date.now() + LISTING_LIFETIME_DAYS * 86_400_000),
        ...(status === 'active' && !existing.publishedAt ? { publishedAt: new Date() } : {}),
      })
      .where(eq(listings.id, existing.id));
    await this.cache.del(cacheKey(publicId));
    await this.requestSearchSync(existing.id);
    return { publicId, status };
  }

  async pause(user: AuthUser, publicId: string) {
    const existing = await this.ownedListing(user, publicId);
    if (existing.status !== 'active') throw new ConflictException('فقط آگهی فعال را می‌توان متوقف کرد');
    await this.db.primary.update(listings).set({ status: 'paused' }).where(eq(listings.id, existing.id));
    await this.cache.del(cacheKey(publicId));
    await this.requestSearchSync(existing.id);
    return { publicId, status: 'paused' as const };
  }

  async resume(user: AuthUser, publicId: string) {
    const existing = await this.ownedListing(user, publicId);
    if (existing.status !== 'paused') throw new ConflictException('فقط آگهی متوقف قابل ازسرگیری است');
    // مهلت گذشته باشد، ازسرگیری یعنی تمدید
    if (!existing.expiresAt || existing.expiresAt.getTime() < Date.now()) return this.renew(user, publicId);
    await this.db.primary.update(listings).set({ status: 'active' }).where(eq(listings.id, existing.id));
    await this.cache.del(cacheKey(publicId));
    await this.requestSearchSync(existing.id);
    return { publicId, status: 'active' as const };
  }

  async remove(user: AuthUser, publicId: string) {
    const existing = await this.ownedListing(user, publicId);
    await this.db.primary
      .update(listings)
      .set({ deletedAt: new Date() })
      .where(eq(listings.id, existing.id));
    await this.cache.del(cacheKey(publicId));
    if (existing.status === 'active') await this.requestSearchSync(existing.id);
  }

  /* ───────────── کمکی ───────────── */

  /**
   * ایندکس جستجو را برای این آگهی به‌روز می‌کند (job صف؛ وضعیت فعلی از دیتابیس خوانده می‌شود).
   * هر تغییری که روی نتیجه‌ی جستجو اثر دارد باید این را صدا بزند: ویرایش، حذف، تغییر وضعیت (تأیید ادمین)،
   * عکس اصلی، ارتقا. شکست صف نباید عملیات کاربر را خراب کند؛ reindex شبانه جبران می‌کند.
   */
  async requestSearchSync(listingId: string): Promise<void> {
    try {
      await this.queue.enqueue(
        'search.sync-listing',
        { listingId },
        { attempts: 5, removeOnComplete: true },
      );
    } catch (error) {
      this.logger.warn(`صف کردن همگام‌سازی جستجو ناموفق بود (${listingId}): ${String(error)}`);
    }
  }

  /** آگهی متعلق به کاربر (یا هر آگهی برای ادمین)؛ وگرنه ۴۰۴ (وجود آگهی دیگران را لو نمی‌دهیم) */
  async ownedListing(user: AuthUser, publicId: string) {
    const [row] = await this.db.primary
      .select()
      .from(listings)
      .where(and(eq(listings.publicId, publicId), isNull(listings.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('آگهی پیدا نشد');
    if (row.ownerId !== user.id && user.role !== 'admin')
      throw new ForbiddenException('این آگهی متعلق به شما نیست');
    return row;
  }

  /** مثل ownedListing ولی با شناسه‌ی داخلی (برای رسانه‌ها) */
  async ownedListingById(user: AuthUser, listingId: string) {
    const [row] = await this.db.primary
      .select()
      .from(listings)
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('آگهی پیدا نشد');
    if (row.ownerId !== user.id && user.role !== 'admin')
      throw new ForbiddenException('این آگهی متعلق به شما نیست');
    return row;
  }

  async idByPublicId(publicId: string): Promise<string> {
    const [row] = await this.db.replica
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.publicId, publicId),
          isNull(listings.deletedAt),
          eq(listings.status, 'active'),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('آگهی پیدا نشد');
    return row.id;
  }

  private async validAmenityIds(ids: number[]): Promise<number[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const found = await this.db.primary
      .select({ id: amenities.id })
      .from(amenities)
      .where(inArray(amenities.id, unique));
    if (found.length !== unique.length) throw new BadRequestException('یکی از امکانات نامعتبر است');
    return unique;
  }

  private async agentIdOf(userId: string): Promise<string | null> {
    const [row] = await this.db.primary
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.userId, userId), isNull(agents.deletedAt)))
      .limit(1);
    return row?.id ?? null;
  }
}
