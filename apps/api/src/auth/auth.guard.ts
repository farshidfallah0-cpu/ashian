import type { UserRole } from '@ashian/shared';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ACCESS_COOKIE } from './auth.types.js';
import { IS_PUBLIC, ROLES } from './decorators.js';
import { TokenService } from './token.service.js';

/** توکن را از کوکی httpOnly یا هدر Authorization: Bearer (برای کلاینت‌های غیرمرورگر) می‌خواند */
function extractToken(req: FastifyRequest): string | undefined {
  const cookie = req.cookies?.[ACCESS_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets);

    const token = extractToken(req);
    const user = token ? await this.tokens.verifyAccess(token) : null;
    if (user) req.user = user;

    if (isPublic) return true;
    if (!user) throw new UnauthorizedException('ابتدا وارد شوید');

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException('دسترسی کافی ندارید');
    return true;
  }
}
