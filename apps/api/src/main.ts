import 'reflect-metadata';
import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { loadRootEnv } from '@ashian/shared/env';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadApiEnv } from './config/env.js';

async function bootstrap() {
  loadRootEnv();
  const env = loadApiEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env),
    new FastifyAdapter({
      // پشت load balancer: IP واقعی کاربر برای rate limiting
      trustProxy: true,
      bodyLimit: 1024 * 1024,
      requestTimeout: 15_000,
      // توکن آپلود محلی (payload + امضا) در مسیر می‌آید و از ۱۰۰ کاراکتر پیش‌فرض بلندتر است
      routerOptions: { maxParamLength: 512 },
    }),
    { bufferLogs: true },
  );

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // پیامک کنسولی فقط برای توسعه است؛ در production کد ورود در لاگ نباید چاپ شود
  if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'console') {
    throw new Error('SMS_PROVIDER=console در production مجاز نیست؛ سرویس پیامک واقعی تنظیم کنید.');
  }

  await app.register(fastifyCookie);

  // آپلود مستقیم تصویر (حالت lite): بدنه‌ی image/* به‌صورت Buffer خوانده می‌شود
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      /^image\/(jpeg|png|webp|avif)$/,
      { parseAs: 'buffer', bodyLimit: 16 * 1024 * 1024 },
      (_req, body, done) => done(null, body),
    );

  await app.register(helmet, {
    // API فقط JSON برمی‌گرداند؛ CSP سخت به‌جز صفحه‌ی مستندات
    contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  });

  // همه‌ی مسیرها زیر /v1 (به‌جز health)
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Ashian API')
      .setDescription('API پلتفرم آگهی ملک آشیان')
      .setVersion('1')
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config));
  }

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  app.get(Logger).log(`API آماده است: ${env.API_URL} (حالت ${env.INFRA_MODE})`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
