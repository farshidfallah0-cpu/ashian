import type { UserRole } from '@ashian/shared';
import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthUser } from './auth.types.js';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/**
 * همه‌ی مسیرها به‌طور پیش‌فرض نیاز به ورود دارند (امن‌بودن پیش‌فرض).
 * @Public() مسیر را باز می‌کند؛ اگر کاربر وارد شده باشد، باز هم شناسایی می‌شود (برای «علاقه‌مندی» و …).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** دسترسی فقط برای نقش‌های مشخص */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** کاربر وارد‌شده؛ در مسیرهای @Public ممکن است undefined باشد */
export const CurrentUser = createParamDecorator(
  (data: { required?: boolean } | undefined, ctx: ExecutionContext): AuthUser | undefined => {
    const user = ctx.switchToHttp().getRequest<FastifyRequest>().user;
    if (!user && data?.required) throw new UnauthorizedException();
    return user;
  },
);
