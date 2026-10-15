import { randomUUID } from 'node:crypto';
import type { DbClient } from '@ashian/db';
import { and, asc, count, eq, inArray, schema } from '@ashian/db';
import type { ObjectStorage, QueueClient } from '@ashian/infra';
import {
  EXTENSION_BY_TYPE,
  MAX_MEDIA_PER_LISTING,
  UPLOAD_RULES,
  type PresignMediaInput,
} from '@ashian/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { DB, QUEUE, STORAGE } from '../infra/tokens.js';
import { ListingsService } from '../listings/listings.service.js';

const { listingMedia } = schema;

/** امضای فایل (magic bytes)؛ ادعای Content-Type کاربر به‌تنهایی کافی نیست */
const SIGNATURES: Array<{ type: string; test: (b: Buffer) => boolean }> = [
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    test: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: 'image/webp',
    test: (b) =>
      b.subarray(0, 4).toString('latin1') === 'RIFF' &&
      b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    type: 'image/avif',
    test: (b) =>
      b.subarray(4, 8).toString('latin1') === 'ftyp' &&
      /avif|avis/.test(b.subarray(8, 16).toString('latin1')),
  },
];

export function sniffImageType(buffer: Buffer): string | null {
  return SIGNATURES.find((s) => s.test(buffer))?.type ?? null;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(QUEUE) private readonly queue: QueueClient,
    private readonly listingsService: ListingsService,
  ) {}

  /**
   * مرحله‌ی ۱ آپلود: یک ردیف pending می‌سازد و آدرس آپلود مستقیم به S3 (یا آداپتور محلی) می‌دهد.
   * فایل هیچ‌وقت از API عبور نمی‌کند (جز حالت lite).
   */
  async presign(user: AuthUser, input: PresignMediaInput) {
    const listing = await this.listingsService.ownedListing(user, input.listingPublicId);
    const [{ n } = { n: 0 }] = await this.db.primary
      .select({ n: count() })
      .from(listingMedia)
      .where(eq(listingMedia.listingId, listing.id));
    if (n >= MAX_MEDIA_PER_LISTING) {
      throw new ConflictException(`حداکثر ${MAX_MEDIA_PER_LISTING} رسانه برای هر آگهی مجاز است`);
    }

    const mediaId = randomUUID();
    const ext = EXTENSION_BY_TYPE[input.contentType]!;
    // کلید از شناسه‌های سیستمی ساخته می‌شود، هرگز از نام فایل کاربر (جلوگیری از path traversal)
    const originalKey = `listings/${listing.id}/${mediaId}/original.${ext}`;
    const rule = input.kind === 'floorplan' ? UPLOAD_RULES.floorplan : UPLOAD_RULES.image;

    await this.db.primary.insert(listingMedia).values({
      id: mediaId,
      listingId: listing.id,
      kind: input.kind,
      status: 'pending',
      originalKey,
      position: n,
    });
    const upload = await this.storage.presignUpload(originalKey, {
      contentType: input.contentType,
      maxBytes: Math.min(input.sizeBytes, rule.maxBytes),
      expiresInSeconds: 600,
    });
    return { mediaId, upload };
  }

  /** مرحله‌ی ۲: بعد از آپلود موفق، پردازش در worker صف می‌شود */
  async complete(user: AuthUser, mediaId: string) {
    const media = await this.ownedMedia(user, mediaId);
    if (media.status !== 'pending') throw new ConflictException('این رسانه قبلاً ثبت شده است');

    const bytes = await this.storage.get(media.originalKey);
    if (!bytes) throw new BadRequestException('فایل هنوز آپلود نشده است');
    if (!sniffImageType(bytes)) {
      await this.storage.delete(media.originalKey);
      await this.db.primary
        .update(listingMedia)
        .set({ status: 'failed' })
        .where(eq(listingMedia.id, media.id));
      throw new BadRequestException('فایل، تصویر معتبری نیست');
    }

    await this.db.primary
      .update(listingMedia)
      .set({ status: 'processing' })
      .where(eq(listingMedia.id, media.id));
    await this.queue.enqueue('media.process', { mediaId: media.id });
    return { mediaId: media.id, status: 'processing' as const };
  }

  async status(user: AuthUser, mediaId: string) {
    const media = await this.ownedMedia(user, mediaId);
    return {
      id: media.id,
      status: media.status,
      width: media.width,
      height: media.height,
      blurhash: media.blurhash,
      variants: media.variants,
      position: media.position,
    };
  }

  async remove(user: AuthUser, mediaId: string) {
    const media = await this.ownedMedia(user, mediaId);
    await this.db.primary.delete(listingMedia).where(eq(listingMedia.id, media.id));
    // فایل‌ها در پس‌زمینه پاک می‌شوند؛ خطا نباید حذف را شکست دهد
    const keys = [
      media.originalKey,
      ...Object.values(media.variants ?? {}).flatMap((v) => Object.values(v ?? {})),
    ];
    await Promise.allSettled(keys.map((k) => this.storage.delete(k)));
    await this.compact(media.listingId);
    await this.listingsService.requestSearchSync(media.listingId);
  }

  /** ترتیب جدید: آرایه‌ی شناسه‌ی رسانه‌ها؛ اولی عکس اصلی می‌شود */
  async reorder(user: AuthUser, listingPublicId: string, order: string[]) {
    const listing = await this.listingsService.ownedListing(user, listingPublicId);
    const existing = await this.db.primary
      .select({ id: listingMedia.id })
      .from(listingMedia)
      .where(and(eq(listingMedia.listingId, listing.id), inArray(listingMedia.id, order)));
    if (existing.length !== order.length || new Set(order).size !== order.length) {
      throw new BadRequestException('فهرست رسانه‌ها نامعتبر است');
    }
    await this.db.primary.transaction(async (tx) => {
      for (const [position, id] of order.entries()) {
        await tx.update(listingMedia).set({ position }).where(eq(listingMedia.id, id));
      }
    });
    await this.compact(listing.id);
    // عکس اصلی (کاور کارت) ممکن است عوض شده باشد
    await this.listingsService.requestSearchSync(listing.id);
  }

  /** موقعیت‌ها را پشت‌سرهم و بدون سوراخ نگه می‌دارد (۰، ۱، ۲ …) */
  private async compact(listingId: string) {
    const rows = await this.db.primary
      .select({ id: listingMedia.id, position: listingMedia.position })
      .from(listingMedia)
      .where(eq(listingMedia.listingId, listingId))
      .orderBy(asc(listingMedia.position), asc(listingMedia.createdAt));
    for (const [i, row] of rows.entries()) {
      if (row.position !== i)
        await this.db.primary
          .update(listingMedia)
          .set({ position: i })
          .where(eq(listingMedia.id, row.id));
    }
  }

  private async ownedMedia(user: AuthUser, mediaId: string) {
    const [media] = await this.db.primary
      .select()
      .from(listingMedia)
      .where(eq(listingMedia.id, mediaId))
      .limit(1);
    if (!media) throw new NotFoundException('رسانه پیدا نشد');
    await this.listingsService.ownedListingById(user, media.listingId);
    return media;
  }
}
