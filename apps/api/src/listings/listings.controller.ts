import {
  DEAL_TYPES,
  LISTING_STATUSES,
  createLeadSchema,
  createListingSchema,
  reportListingSchema,
  updateListingSchema,
  type CreateLeadInput,
  type CreateListingInput,
  type ListingStatus,
  type ReportListingInput,
  type UpdateListingInput,
} from '@ashian/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { parsePagination, PublicIdPipe } from '../common/pipes.js';
import { LeadsService } from './leads.service.js';
import { ListingCompareService, MAX_CARDS, MAX_COMPARE, parseIds } from './listing-compare.service.js';
import { ListingExtrasService } from './listing-extras.service.js';
import { ListingsService } from './listings.service.js';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly service: ListingsService,
    private readonly extras: ListingExtrasService,
    private readonly leads: LeadsService,
    private readonly compareService: ListingCompareService,
  ) {}

  // «mine» قبل از «:publicId» تعریف می‌شود تا به‌عنوان شناسه تفسیر نشود
  @Get('mine')
  @ApiOperation({ summary: 'آگهی‌های من' })
  mine(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    const status = typeof query.status === 'string' ? query.status : undefined;
    if (status && !(LISTING_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException('وضعیت نامعتبر است');
    }
    return this.service.mine(user!, {
      status: status as ListingStatus | undefined,
      ...parsePagination(query),
    });
  }

  /** اعتبارسنجی نیمه‌کاره‌ی ورودی ویزارد (خطای هر فیلد + هشدار داده‌ی غیرعادی) */
  @Post('validate')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'اعتبارسنجی مرحله‌ای آگهی (بدون ذخیره)' })
  validate(
    @CurrentUser({ required: true }) _user: AuthUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.validatePartial(body && typeof body === 'object' ? body : {});
  }

  /** راهنمای قیمت: آمار بازار محله برای مکان، معامله و تعداد خواب */
  @Public()
  @Get('market')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'میانگین قیمت محله برای راهنمای قیمت‌گذاری' })
  async market(@Query() query: Record<string, unknown>) {
    const { locationId, dealType, bedrooms } = query;
    if (
      typeof locationId !== 'string' ||
      !(DEAL_TYPES as readonly string[]).includes(String(dealType)) ||
      !/^\d{1,2}$/.test(String(bedrooms))
    ) {
      throw new BadRequestException('locationId، dealType و bedrooms لازم است');
    }
    const result = await this.extras.marketFor(locationId, String(dealType), Number(bedrooms));
    if (!result) throw new NotFoundException('مکان پیدا نشد');
    return result;
  }

  /** کارت چند آگهی با شناسه (بازدیدهای اخیر)؛ شناسه‌ها از مرورگر می‌آیند */
  @Public()
  @Get('cards')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'کارت آگهی‌ها با شناسه (حداکثر ۳۰)' })
  cards(@Query('ids') ids: unknown) {
    return this.compareService.cards(parseIds(ids, MAX_CARDS));
  }

  /** مقایسه‌ی حداکثر ۴ ملک؛ عمومی تا مهمان هم بتواند مقایسه کند */
  @Public()
  @Get('compare')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'ویژگی‌های قابل مقایسه‌ی حداکثر ۴ ملک' })
  compare(@Query('ids') ids: unknown) {
    return this.compareService.compare(parseIds(ids, MAX_COMPARE));
  }

  @Public()
  @Get(':publicId')
  // پاسخ برای هر کاربر متفاوت است (مالک، علاقه‌مندی)؛ CDN نباید ذخیره کند. کش ۳۰ ثانیه‌ای سمت API است.
  @Header('Cache-Control', 'private, no-cache')
  @ApiOperation({ summary: 'جزئیات آگهی' })
  detail(
    @Param('publicId', new PublicIdPipe()) publicId: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.service.getDetail(publicId, user);
  }

  /** بازدید: مرورگر بعد از نمایش صفحه صدا می‌زند؛ فقط در صف شمرده می‌شود */
  @Public()
  @Post(':publicId/view')
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت بازدید آگهی (از طریق صف)' })
  async view(@Param('publicId', new PublicIdPipe()) publicId: string, @Req() req: FastifyRequest) {
    await this.service.recordView(publicId, {
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] ?? ''),
    });
  }

  @Public()
  @Get(':publicId/similar')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'آگهی‌های مشابه' })
  similar(@Param('publicId', new PublicIdPipe()) publicId: string) {
    return this.extras.similar(publicId);
  }

  @Public()
  @Get(':publicId/agent-listings')
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @ApiOperation({ summary: 'آگهی‌های دیگر همین مشاور' })
  agentListings(@Param('publicId', new PublicIdPipe()) publicId: string) {
    return this.extras.fromAgent(publicId);
  }

  @Public()
  @Get(':publicId/neighborhood')
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
  @ApiOperation({ summary: 'آمار محله و مقایسه با این آگهی' })
  neighborhood(@Param('publicId', new PublicIdPipe()) publicId: string) {
    return this.extras.neighborhood(publicId);
  }

  @Public()
  @Get(':publicId/nearby')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'نزدیک‌ترین مترو، مدرسه، بیمارستان و مرکز خرید' })
  nearby(@Param('publicId', new PublicIdPipe()) publicId: string) {
    return this.extras.nearby(publicId);
  }

  @Public()
  @Post(':publicId/leads')
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت سرنخ (تماس، واتساپ، پیام، درخواست بازدید)' })
  lead(
    @Param('publicId', new PublicIdPipe()) publicId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Body(new ZodValidationPipe(createLeadSchema)) body: CreateLeadInput,
  ) {
    return this.leads.createLead(publicId, body, user);
  }

  @Public()
  @Post(':publicId/report')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'گزارش آگهی' })
  report(
    @Param('publicId', new PublicIdPipe()) publicId: string,
    @CurrentUser() user: AuthUser | undefined,
    @Body(new ZodValidationPipe(reportListingSchema)) body: ReportListingInput,
  ) {
    return this.leads.report(publicId, body, user);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'ساخت پیش‌نویس آگهی' })
  create(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(createListingSchema)) body: CreateListingInput,
  ) {
    return this.service.create(user!, body);
  }

  @Patch(':publicId')
  @ApiOperation({ summary: 'ویرایش آگهی' })
  update(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
    @Body(new ZodValidationPipe(updateListingSchema)) body: UpdateListingInput,
  ) {
    return this.service.update(user!, publicId, body);
  }

  /** هشدارها، آگهی‌های تکراری و وضعیت عکس‌ها پیش از ارسال */
  @Get(':publicId/review')
  @ApiOperation({ summary: 'بررسی پیش از ارسال' })
  review(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    return this.service.review(user!, publicId);
  }

  @Post(':publicId/submit')
  @HttpCode(200)
  @ApiOperation({ summary: 'ارسال برای بررسی (confirm=true یعنی هشدارها دیده و تأیید شد)' })
  submit(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
    @Body() body: { confirm?: boolean } | undefined,
  ) {
    return this.service.submit(user!, publicId, body?.confirm === true);
  }

  @Delete(':publicId')
  @HttpCode(204)
  @ApiOperation({ summary: 'حذف آگهی (soft delete)' })
  async remove(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    await this.service.remove(user!, publicId);
  }
}
