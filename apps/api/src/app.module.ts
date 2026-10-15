import type { Cache } from '@ashian/infra';
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CacheThrottlerStorage } from './common/cache-throttler.storage.js';
import { AccountModule } from './account/account.module.js';
import { AgentsModule } from './agents/agents.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ConfigModule } from './config/config.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { MediaModule } from './media/media.module.js';
import { HomeModule } from './home/home.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { SavedSearchesModule } from './saved-searches/saved-searches.module.js';
import { SearchModule } from './search/search.module.js';
import { API_ENV, type ApiEnv } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { InfraModule } from './infra/infra.module.js';
import { CACHE } from './infra/tokens.js';
import { SystemController } from './system/system.controller.js';

@Module({})
export class AppModule {
  static forRoot(env: ApiEnv): DynamicModule {
    const isDev = env.NODE_ENV === 'development';
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            // در توسعه خوانا، در production JSON ساختاریافته
            transport: isDev
              ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } }
              : undefined,
            // فقط اطلاعات لازم؛ هدرها (شامل کوکی و توکن) لاگ نمی‌شوند
            serializers: {
              req: (req: { id: string; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            // health و فایل‌های رسانه لاگ نمی‌شوند (حجم زیاد، ارزش کم)
            autoLogging: {
              ignore: (req) => /^\/(health|media\/)/.test(req.url ?? ''),
            },
            customProps: () => ({ service: 'api' }),
          },
        }),
        InfraModule,
        ThrottlerModule.forRootAsync({
          inject: [API_ENV, CACHE],
          useFactory: (config: ApiEnv, cache: Cache) => ({
            throttlers: [
              {
                name: 'default',
                ttl: config.RATE_LIMIT_TTL_SECONDS * 1000,
                limit: config.RATE_LIMIT_MAX,
              },
            ],
            storage: new CacheThrottlerStorage(cache),
          }),
        }),
        AuthModule,
        LocationsModule,
        AgentsModule,
        ListingsModule,
        MediaModule,
        FavoritesModule,
        SearchModule,
        HomeModule,
        SavedSearchesModule,
    AccountModule,
    PaymentsModule,
      ],
      controllers: [HealthController, SystemController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
