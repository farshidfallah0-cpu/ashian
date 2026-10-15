import {
  LEAD_STATUSES,
  addTeamMemberSchema,
  createAgencySchema,
  joinAgentSchema,
  leadStatusSchema,
  updateAgencySchema,
  updateAgentProfileSchema,
  type AddTeamMemberInput,
  type CreateAgencyInput,
  type JoinAgentInput,
  type LeadStatus,
  type LeadStatusInput,
  type UpdateAgencyInput,
  type UpdateAgentProfileInput,
} from '@ashian/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { parsePagination, PublicIdPipe, UuidPipe } from '../common/pipes.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ListingsService } from '../listings/listings.service.js';
import { PanelService } from './panel.service.js';

const statusOf = (value: unknown): LeadStatus | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !(LEAD_STATUSES as readonly string[]).includes(value)) {
    throw new BadRequestException('وضعیت نامعتبر است');
  }
  return value as LeadStatus;
};
const daysOf = (value: unknown) => (typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : undefined);

/** پنل مشاور و آژانس؛ همه به ورود نیاز دارند و دسترسی از دیتابیس سنجیده می‌شود */
@ApiTags('agent-panel')
@Controller()
export class PanelController {
  constructor(
    private readonly panel: PanelService,
    private readonly listingsService: ListingsService,
  ) {}

  @Get('agent/me')
  @ApiOperation({ summary: 'نقش من: مشاور یا مدیر آژانس' })
  me(@CurrentUser({ required: true }) user: AuthUser | undefined) {
    return this.panel.me(user!);
  }

  @Post('agent/join')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'ثبت‌نام به‌عنوان مشاور (تأیید BRN توسط تیم آشیان)' })
  join(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(joinAgentSchema)) body: JoinAgentInput,
  ) {
    return this.panel.join(user!, body);
  }

  @Patch('agent/profile')
  @HttpCode(204)
  @ApiOperation({ summary: 'ویرایش پروفایل مشاور' })
  async updateProfile(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(updateAgentProfileSchema)) body: UpdateAgentProfileInput,
  ) {
    await this.panel.updateProfile(user!, body);
  }

  @Get('agent/dashboard')
  @ApiOperation({ summary: 'داشبورد آمار مشاور (بازدید، سرنخ، نرخ تبدیل، نشان)' })
  dashboard(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query('days') days?: string,
  ) {
    return this.panel.dashboard(user!, daysOf(days));
  }

  @Get('agent/leads')
  @ApiOperation({ summary: 'صندوق سرنخ مشاور' })
  leads(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.panel.myLeads(user!, { status: statusOf(query.status), ...parsePagination(query) });
  }

  @Patch('agent/leads/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'تغییر وضعیت سرنخ (مشاور یا مدیر آژانس)' })
  async leadStatus(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(leadStatusSchema)) body: LeadStatusInput,
  ) {
    await this.panel.setLeadStatus(user!, id, body.status);
  }

  /* مدیریت آگهی: تمدید، توقف، ازسرگیری (فقط مالک آگهی) */
  @Post('agent/listings/:publicId/renew')
  @HttpCode(200)
  @ApiOperation({ summary: 'تمدید آگهی برای ۳۰ روز دیگر' })
  renew(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    return this.listingsService.renew(user!, publicId);
  }

  @Post('agent/listings/:publicId/pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'توقف نمایش آگهی (از جستجو برداشته می‌شود)' })
  pause(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    return this.listingsService.pause(user!, publicId);
  }

  @Post('agent/listings/:publicId/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'ازسرگیری آگهی متوقف‌شده' })
  resume(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
  ) {
    return this.listingsService.resume(user!, publicId);
  }

  /* آژانس */
  @Post('agency')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'ساخت آژانس (تأیید مجوز توسط تیم آشیان)' })
  createAgency(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(createAgencySchema)) body: CreateAgencyInput,
  ) {
    return this.panel.createAgency(user!, body);
  }

  @Patch('agency')
  @HttpCode(204)
  @ApiOperation({ summary: 'ویرایش مشخصات آژانس' })
  async updateAgency(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(updateAgencySchema)) body: UpdateAgencyInput,
  ) {
    await this.panel.updateAgency(user!, body);
  }

  @Get('agency/overview')
  @ApiOperation({ summary: 'آمار تجمیعی آژانس و عملکرد هر مشاور' })
  overview(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query('days') days?: string,
  ) {
    return this.panel.agencyOverview(user!, daysOf(days));
  }

  @Get('agency/leads')
  @ApiOperation({ summary: 'سرنخ‌های همه‌ی مشاوران آژانس' })
  agencyLeads(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.panel.agencyLeads(user!, { status: statusOf(query.status), ...parsePagination(query) });
  }

  @Post('agency/team')
  @HttpCode(201)
  @ApiOperation({ summary: 'افزودن مشاور به تیم با شماره‌ی موبایل' })
  addMember(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(addTeamMemberSchema)) body: AddTeamMemberInput,
  ) {
    return this.panel.addMember(user!, body.phone);
  }

  @Delete('agency/team/:agentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'حذف مشاور از تیم' })
  async removeMember(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('agentId', new UuidPipe()) agentId: string,
  ) {
    await this.panel.removeMember(user!, agentId);
  }
}