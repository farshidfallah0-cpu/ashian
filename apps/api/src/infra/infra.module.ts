import { createDb, type DbClient } from '@ashian/db';
import {
  createCache,
  createQueueClient,
  createStorage,
  type Cache,
  type QueueClient,
} from '@ashian/infra';
import { createSearchEngine, type SearchEngine } from '@ashian/search';
import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type Provider,
} from '@nestjs/common';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { CACHE, DB, QUEUE, SEARCH_ENGINE, STORAGE } from './tokens.js';

const providers: Provider[] = [
  {
    provide: DB,
    inject: [API_ENV],
    useFactory: (env: ApiEnv): DbClient =>
      createDb({
        url: env.DATABASE_URL,
        replicaUrl: env.DATABASE_REPLICA_URL,
        poolMax: env.DATABASE_POOL_MAX,
        applicationName: 'ashian-api',
      }),
  },
  { provide: CACHE, inject: [API_ENV], useFactory: (env: ApiEnv) => createCache(env) },
  { provide: QUEUE, inject: [API_ENV], useFactory: (env: ApiEnv) => createQueueClient(env) },
  { provide: STORAGE, inject: [API_ENV], useFactory: (env: ApiEnv) => createStorage(env) },
  {
    provide: SEARCH_ENGINE,
    inject: [API_ENV],
    useFactory: (env: ApiEnv) => createSearchEngine(env),
  },
];

/** آداپتورهای زیرساخت؛ نوع هر کدام با INFRA_MODE تعیین می‌شود */
@Global()
@Module({ providers, exports: [DB, CACHE, QUEUE, STORAGE, SEARCH_ENGINE] })
export class InfraModule implements OnApplicationShutdown {
  private readonly logger = new Logger(InfraModule.name);

  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(QUEUE) private readonly queue: QueueClient,
    @Inject(SEARCH_ENGINE) private readonly search: SearchEngine,
  ) {}

  async onApplicationShutdown() {
    const results = await Promise.allSettled([
      this.queue.close(),
      this.search.close(),
      this.cache.close(),
      this.db.close(),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') this.logger.warn(`خطا هنگام بستن اتصال: ${String(r.reason)}`);
    }
  }
}
