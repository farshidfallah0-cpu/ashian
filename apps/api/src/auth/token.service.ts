import { randomUUID } from 'node:crypto';
import type { Cache } from '@ashian/infra';
import type { UserRole } from '@ashian/shared';
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { CACHE } from '../infra/tokens.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, type AuthUser } from './auth.types.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const rtKey = (userId: string, jti: string) => `rt:${userId}:${jti}`;

/**
 * توکن دسترسی کوتاه‌عمر (۱۵ دقیقه) و توکن نوسازی بلندعمر (۳۰ روز) با چرخش:
 * هر نوسازی توکن قبلی را باطل می‌کند. jti توکن‌های معتبر در کش (Redis) نگه داشته می‌شود
 * تا API بدون وضعیت بماند و باطل‌سازی روی همه‌ی نسخه‌ها فوراً اعمال شود.
 */
@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(
    @Inject(API_ENV) env: ApiEnv,
    @Inject(CACHE) private readonly cache: Cache,
  ) {
    this.accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    this.refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  }

  async issue(user: AuthUser): Promise<TokenPair> {
    const jti = randomUUID();
    const accessToken = await new SignJWT({ role: user.role, use: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
      .sign(this.accessKey);
    const refreshToken = await new SignJWT({ use: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${REFRESH_TTL_SECONDS}s`)
      .sign(this.refreshKey);
    await this.cache.set(rtKey(user.id, jti), 1, REFRESH_TTL_SECONDS);
    return { accessToken, refreshToken };
  }

  /** توکن دسترسی را بررسی می‌کند؛ نامعتبر یا منقضی → null */
  async verifyAccess(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, { algorithms: ['HS256'] });
      if (payload.use !== 'access' || !payload.sub) return null;
      return { id: payload.sub, role: payload.role as UserRole };
    } catch {
      return null;
    }
  }

  /**
   * توکن نوسازی را مصرف می‌کند: اگر معتبر و هنوز فعال باشد، باطل می‌شود و userId برمی‌گردد.
   * استفاده‌ی دوباره از یک توکن (مثلاً دزدیده‌شده) null می‌دهد.
   */
  async consumeRefresh(token: string): Promise<string | null> {
    try {
      const { payload } = await jwtVerify(token, this.refreshKey, { algorithms: ['HS256'] });
      if (payload.use !== 'refresh' || !payload.sub || !payload.jti) return null;
      const key = rtKey(payload.sub, payload.jti);
      if ((await this.cache.get(key)) === null) return null;
      await this.cache.del(key);
      return payload.sub;
    } catch {
      return null;
    }
  }

  /** خروج: توکن نوسازی باطل می‌شود (خطا نمی‌دهد اگر نامعتبر باشد) */
  async revokeRefresh(token: string): Promise<void> {
    try {
      const { payload } = await jwtVerify(token, this.refreshKey, { algorithms: ['HS256'] });
      if (payload.sub && payload.jti) await this.cache.del(rtKey(payload.sub, payload.jti));
    } catch {
      /* توکن قبلاً نامعتبر بوده؛ کاری لازم نیست */
    }
  }
}
