import type { DbClient } from '@ashian/db';
import type { Cache, ObjectStorage, QueueClient } from '@ashian/infra';
import type { SearchEngine } from '@ashian/search';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { CACHE, DB, QUEUE, SEARCH_ENGINE, STORAGE } from '../infra/tokens.js';

type CheckResult = { ok: boolean; ms: number; error?: string };

async function check(fn: () => Promise<boolean>, timeoutMs = 2_000): Promise<CheckResult> {
  const start = performance.now();
  try {
    const ok = await Promise.race([
      fn(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      ),
    ]);
    return { ok, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - start), error: String(error) };
  }
}

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(QUEUE) private readonly queue: QueueClient,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(SEARCH_ENGINE) private readonly search: SearchEngine,
  ) {}

  /** liveness: پروسه زنده است (برای load balancer؛ بدون وابستگی بیرونی) */
  @Get()
  @HttpCode(200)
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  /** readiness: همه‌ی وابستگی‌ها در دسترس‌اند */
  @Get('ready')
  async ready() {
    const [database, cache, storage, search, queue] = await Promise.all([
      check(() => this.db.ping()),
      check(() => this.cache.ping()),
      check(() => this.storage.ping()),
      check(() => this.search.ping()),
      check(async () => {
        await this.queue.counts();
        return true;
      }, 5_000),
    ]);
    const checks = { database, cache, storage, search, queue };
    const body = {
      status: Object.values(checks).every((c) => c.ok) ? 'ok' : 'degraded',
      mode: this.env.INFRA_MODE,
      adapters: { cache: this.cache.kind, storage: this.storage.kind, search: this.search.kind },
      checks,
    };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
