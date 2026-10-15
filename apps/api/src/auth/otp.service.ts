import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Cache } from '@ashian/infra';
import { OTP_LENGTH } from '@ashian/shared';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { CACHE } from '../infra/tokens.js';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_SECONDS, OTP_TTL_SECONDS } from './auth.types.js';
import { SMS_PROVIDER, type SmsProvider } from './sms.provider.js';

interface OtpRecord {
  hash: string;
  attempts: number;
}

const otpKey = (phone: string) => `otp:${phone}`;
const cooldownKey = (phone: string) => `otp:cd:${phone}`;
const hourlyKey = (phone: string) => `otp:hr:${phone}`;
/** حداکثر درخواست کد برای یک شماره در ساعت (جلوگیری از SMS bombing) */
const MAX_REQUESTS_PER_HOUR = 5;

@Injectable()
export class OtpService {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /** کد هش می‌شود؛ حتی اگر کش لو برود، کد خام در دسترس نیست */
  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.env.JWT_ACCESS_SECRET)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  async request(
    phone: string,
  ): Promise<{ expiresInSeconds: number; retryAfterSeconds: number; devCode?: string }> {
    const cooldown = await this.cache.get<number>(cooldownKey(phone));
    if (cooldown !== null) {
      throw new HttpException(
        {
          message: 'لطفاً کمی صبر کنید و دوباره درخواست دهید',
          retryAfterSeconds: OTP_RESEND_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const { count } = await this.cache.increment(hourlyKey(phone), 60 * 60 * 1000);
    if (count > MAX_REQUESTS_PER_HOUR) {
      throw new HttpException(
        'تعداد درخواست کد برای این شماره زیاد است. بعداً تلاش کنید.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
    await this.cache.set<OtpRecord>(
      otpKey(phone),
      { hash: this.hash(phone, code), attempts: 0 },
      OTP_TTL_SECONDS,
    );
    await this.cache.set(cooldownKey(phone), 1, OTP_RESEND_SECONDS);
    await this.sms.send(phone, `کد ورود آشیان: ${code}`);

    // فقط در توسعه با پیامک کنسولی، کد برای آسان‌تر شدن تست در پاسخ هم می‌آید
    const exposeCode = this.env.NODE_ENV !== 'production' && this.sms.kind === 'console';
    return {
      expiresInSeconds: OTP_TTL_SECONDS,
      retryAfterSeconds: OTP_RESEND_SECONDS,
      ...(exposeCode ? { devCode: code } : {}),
    };
  }

  /** کد را بررسی و مصرف می‌کند؛ بعد از ۵ تلاش اشتباه کد باطل می‌شود */
  async verify(phone: string, code: string): Promise<void> {
    const record = await this.cache.get<OtpRecord>(otpKey(phone));
    if (!record) throw new UnauthorizedException('کد منقضی شده یا درخواست نشده است');

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await this.cache.del(otpKey(phone));
      throw new UnauthorizedException('تعداد تلاش‌ها بیش از حد مجاز بود؛ کد جدید بگیرید');
    }

    const expected = Buffer.from(record.hash);
    const actual = Buffer.from(this.hash(phone, code));
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!ok) {
      await this.cache.set<OtpRecord>(
        otpKey(phone),
        { ...record, attempts: record.attempts + 1 },
        OTP_TTL_SECONDS,
      );
      throw new UnauthorizedException('کد تأیید اشتباه است');
    }
    await this.cache.del(otpKey(phone));
  }
}
