import type { QueueClient } from '@ashian/infra';
import type { SearchEngine } from '@ashian/search';
import { Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { QUEUE, SEARCH_ENGINE } from '../infra/tokens.js';

@ApiTags('system')
@Roles('admin')
@Controller('system')
export class SystemController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(QUEUE) private readonly queue: QueueClient,
    @Inject(SEARCH_ENGINE) private readonly search: SearchEngine,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'وضعیت ایندکس جستجو (تعداد سندها)' })
  searchStatus() {
    return this.search.stats();
  }

  @Post('search/reindex')
  @ApiOperation({ summary: 'ساخت دوباره‌ی کامل ایندکس جستجو (پس‌زمینه، بدون قطعی)' })
  async reindex() {
    const jobId = await this.queue.enqueue(
      'search.reindex',
      { reason: 'درخواست ادمین' },
      { attempts: 1, removeOnComplete: true },
    );
    return { jobId };
  }

  /** اجرای فوری بررسی هشدار جستجوهای ذخیره‌شده (تست و عملیات) */
  @Post('alerts/run')
  @ApiOperation({ summary: 'اجرای فوری job هشدار جستجوهای ذخیره‌شده' })
  async runAlerts() {
    const jobId = await this.queue.enqueue(
      'notifications.run-alerts',
      { tick: `manual-${Date.now()}` },
      { attempts: 1, removeOnComplete: true },
    );
    return { jobId };
  }

  /** اجرای فوری محاسبه‌ی آمار و نشان مشاوران */
  @Post('agents/refresh')
  @ApiOperation({ summary: 'محاسبه‌ی فوری نشان مشاور برتر و آمار مشاوران' })
  async refreshAgents() {
    const jobId = await this.queue.enqueue(
      'analytics.refresh-agents',
      { tick: `manual-${Date.now()}` },
      { attempts: 1, removeOnComplete: true },
    );
    return { jobId };
  }

  @Get('queues')
  @ApiOperation({ summary: 'وضعیت صف‌ها' })
  queues() {
    return this.queue.counts();
  }

  /** فقط در توسعه: یک job نمونه به worker می‌فرستد تا زنجیره‌ی صف تست شود */
  @Post('heartbeat')
  @ApiOperation({ summary: 'ارسال job نمونه به worker (فقط توسعه)' })
  async heartbeat() {
    const jobId = await this.queue.enqueue('system.heartbeat', {
      sentAt: new Date().toISOString(),
      source: `api:${this.env.NODE_ENV}`,
    });
    return { jobId };
  }
}
