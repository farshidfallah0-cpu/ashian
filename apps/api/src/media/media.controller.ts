import { verifyLocalUploadToken, type ObjectStorage } from '@ashian/infra';
import { isPublicId, presignMediaSchema, type PresignMediaInput } from '@ashian/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { UuidPipe } from '../common/pipes.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { STORAGE } from '../infra/tokens.js';
import { MediaService, sniffImageType } from './media.service.js';

const reorderSchema = z.object({
  listingPublicId: z.string().refine(isPublicId),
  order: z.array(z.uuid()).min(1).max(40),
});

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    private readonly service: MediaService,
  ) {}

  @Post('presign')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'گرفتن آدرس آپلود مستقیم' })
  presign(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(presignMediaSchema)) body: PresignMediaInput,
  ) {
    return this.service.presign(user!, body);
  }

  @Put('reorder')
  @HttpCode(204)
  @ApiOperation({ summary: 'تغییر ترتیب رسانه‌ها؛ اولی عکس اصلی' })
  async reorder(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(reorderSchema)) body: z.infer<typeof reorderSchema>,
  ) {
    await this.service.reorder(user!, body.listingPublicId, body.order);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'اعلام پایان آپلود و شروع پردازش' })
  complete(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
  ) {
    return this.service.complete(user!, id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'وضعیت پردازش یک رسانه' })
  status(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
  ) {
    return this.service.status(user!, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'حذف رسانه' })
  async remove(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
  ) {
    await this.service.remove(user!, id);
  }

  /**
   * فقط حالت lite: دریافت فایل با توکن امضاشده (جایگزین presigned URL در S3).
   * توکن، نوع، سقف حجم و کلید مقصد را تعیین می‌کند؛ کاربر هیچ‌کدام را نمی‌تواند عوض کند.
   */
  @Public()
  @Put('local-upload/:token')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'آپلود محلی (فقط توسعه)' })
  async localUpload(
    @Param('token') token: string,
    @Headers('content-type') contentType: string | undefined,
    @Body() body: unknown,
  ) {
    if (this.storage.kind !== 'local') throw new NotFoundException();
    const claims = verifyLocalUploadToken(token, this.env.MEDIA_SIGNING_SECRET);
    if (!claims) throw new BadRequestException('آدرس آپلود نامعتبر یا منقضی است');
    if (!Buffer.isBuffer(body) || body.length === 0)
      throw new BadRequestException('فایلی ارسال نشد');
    if (body.length > claims.maxBytes) throw new BadRequestException('حجم فایل بیش از حد مجاز است');
    if (contentType?.split(';')[0] !== claims.contentType)
      throw new BadRequestException('نوع فایل با درخواست آپلود یکسان نیست');
    if (sniffImageType(body) !== claims.contentType)
      throw new BadRequestException('محتوای فایل با نوع اعلام‌شده یکی نیست');
    await this.storage.put(claims.key, body, claims.contentType);
  }
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/**
 * سرو فایل‌ها از ذخیره‌ی محلی (حالت lite). در production فایل‌ها از CDN/S3 خوانده می‌شوند
 * و این مسیر فقط به آدرس عمومی هدایت می‌کند. فایل‌های اصلی آپلودی (original.*) هرگز سرو نمی‌شوند.
 */
@ApiTags('media')
@Controller({ path: 'media', version: VERSION_NEUTRAL })
export class MediaFilesController {
  constructor(@Inject(STORAGE) private readonly storage: ObjectStorage) {}

  @Public()
  @SkipThrottle()
  @Get('*')
  async serve(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // wildcard فستیفای با کلید «*» در params می‌آید
    const rawPath = (req.params as Record<string, string | undefined>)['*'] ?? '';
    const key = rawPath.replace(/^\/+/, '');
    const ext = key.split('.').pop()?.toLowerCase() ?? '';
    const type = CONTENT_TYPE_BY_EXT[ext];
    // فایل‌های اصلی و منبع (خام) خصوصی‌اند؛ فقط variantهای پردازش‌شده عمومی‌اند
    if (!type || /(^|\/)(original|source)\./.test(key)) throw new NotFoundException();
    if (this.storage.kind !== 'local') return reply.redirect(this.storage.publicUrl(key), 302);

    let body: Buffer | null;
    try {
      body = await this.storage.get(key);
    } catch {
      throw new NotFoundException(); // کلید نامعتبر (مثل path traversal)
    }
    if (!body) throw new NotFoundException();
    return reply
      .header('Content-Type', type)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .send(body);
  }
}
