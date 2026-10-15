import type { UserRole } from '@ashian/shared';

export interface AuthUser {
  id: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export const ACCESS_COOKIE = 'ashian_at';
export const REFRESH_COOKIE = 'ashian_rt';
/** نشانگر «وارد شده‌ام» برای رابط (httpOnly نیست و هیچ راز یا شناسه‌ای ندارد؛ هویت فقط با کوکی‌های بالا ثابت می‌شود) */
export const SESSION_HINT_COOKIE = 'ashian_session';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
export const OTP_TTL_SECONDS = 120;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
