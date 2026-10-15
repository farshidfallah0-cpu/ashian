import type { DbClient } from '@ashian/db';
import { createWorkers, type QueueClient } from '@ashian/infra';
import {
  alertJobs,
  createIndexer,
  searchJobs,
  startAlertScheduler,
  type SearchEngine,
} from '@ashian/search';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { SMS_PROVIDER, type SmsProvider } from '../auth/sms.provider.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { DB, QUEUE, SEARCH_ENGINE } from '../infra/tokens.js';

/**
 * آماده‌سازی ایندکس جستجو هنگام بالا آمدن API.
 *
 * - full: Typesense یک سرویس بیرونی است و worker آن را به‌روز می‌کند؛ اینجا فقط
 *   مطمئن می‌شویم collection وجود دارد. اگر ایندکس خالی بود یک reindex صف می‌شود.
 * - lite: ایندکس درون‌حافظه‌ی همین پروسه است و worker (پروسه‌ی جدا) به آن دسترسی ندارد؛
 *   پس API خودش ایندکس را از دیتابیس می‌سازد و مصرف‌کننده‌ی صف search است.
 */
@Injectable()
export class SearchIndexerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('SearchIndexer');
  private closeWorkers: (() => Promise<void>) | null = null;
  private stopScheduler: (() => void) | null = null;

  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(DB) private readonly db: DbClient,
    @Inject(QUEUE) private readonly queue: QueueClient,
    @Inject(SEARCH_ENGINE) private readonly engine: SearchEngine,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.engine.ensureReady();
    } catch (error) {
      // API بدون جستجو هم بالا بیاید؛ readiness مشکل را نشان می‌دهد و درخواست‌های جستجو ۵۰۳ می‌گیرند
      this.logger.error(`موتور جستجو در دسترس نیست: ${String(error)}`);
      return;
    }

    if (this.env.INFRA_MODE === 'lite') await this.startLiteIndexer();
    else if (await this.engine.isEmpty()) {
      await this.queue.enqueue('search.reindex', { reason: 'ایندکس خالی هنگام شروع API' });
      this.logger.warn('ایندکس خالی است؛ reindex صف شد (worker باید در حال اجرا باشد).');
    }
  }

  private async startLiteIndexer() {
    const logger = {
      info: (obj: object, msg: string) => this.logger.log(`${msg} ${JSON.stringify(obj)}`),
      warn: (obj: object, msg: string) => this.logger.warn(`${msg} ${JSON.stringify(obj)}`),
    };
    const indexer = createIndexer({ db: this.db, engine: this.engine, logger });

    const started = Date.now();
    const result = await indexer.reindex();
    this.logger.log(
      `ایندکس درون‌حافظه ساخته شد: ${result.listings} آگهی در ${Date.now() - started}ms`,
    );

    // هشدار جستجوهای ذخیره‌شده هم به موتور جستجو نیاز دارد، پس در lite همین‌جا اجرا می‌شود
    const alerts = alertJobs({
      db: this.db,
      engine: this.engine,
      logger,
      siteUrl: this.env.WEB_URL,
      indexer,
      notifier: {
        sms: (phone, text) => this.sms.send(phone, text),
        email: async (to, subject, text) =>
          this.logger.log(`ایمیل هشدار به ${to} «${subject}»: ${text}`),
      },
    });
    const { workers, close } = createWorkers(
      this.env,
      { ...searchJobs({ indexer, logger }), ...alerts },
      { concurrency: { search: 2, notifications: 1 } },
    );
    this.stopScheduler = startAlertScheduler({
      queue: this.queue,
      intervalSeconds: this.env.ALERT_TICK_SECONDS,
      logger,
    });
    for (const worker of workers) {
      worker.on('failed', (job, error) =>
        this.logger.error(`job ${job?.name ?? '?'} ناموفق (تلاش ${job?.attemptsMade}): ${error}`),
      );
      worker.on('error', (error) => this.logger.error(`خطای مصرف‌کننده‌ی صف search: ${error}`));
    }
    this.closeWorkers = close;
  }

  async onModuleDestroy() {
    this.stopScheduler?.();
    await this.closeWorkers?.();
  }
}
