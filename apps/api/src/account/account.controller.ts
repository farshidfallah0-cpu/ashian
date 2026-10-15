import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { parsePagination } from '../common/pipes.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AccountService } from './account.service.js';

const markReadSchema = z.object({ ids: z.array(z.uuid()).max(100).optional() });

@ApiTags('account')
@Controller()
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'اعلان‌های من' })
  notifications(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.notifications(user!.id, {
      ...parsePagination(query),
      unreadOnly: query.unread === '1',
    });
  }

  @Get('notifications/count')
  @ApiOperation({ summary: 'تعداد اعلان‌های خوانده‌نشده' })
  async count(@CurrentUser({ required: true }) user: AuthUser | undefined) {
    return { unread: await this.service.unreadCount(user!.id) };
  }

  @Post('notifications/read')
  @HttpCode(204)
  @ApiOperation({ summary: 'علامت‌گذاری اعلان‌ها به‌عنوان خوانده‌شده' })
  async read(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Body(new ZodValidationPipe(markReadSchema)) body: z.infer<typeof markReadSchema>,
  ) {
    await this.service.markRead(user!.id, body.ids);
  }

  @Get('leads/mine')
  @ApiOperation({ summary: 'پیام‌ها و درخواست‌های بازدید ارسال‌شده توسط من' })
  myLeads(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Query() query: Record<string, unknown>,
  ) {
    const { page, pageSize } = parsePagination(query);
    return this.service.myLeads(user!.id, page, pageSize);
  }
}