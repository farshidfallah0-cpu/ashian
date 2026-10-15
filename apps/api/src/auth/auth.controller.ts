import {
  requestOtpSchema,
  updateProfileSchema,
  verifyOtpSchema,
  type RequestOtpInput,
  type UpdateProfileInput,
  type VerifyOtpInput,
} from '@ashian/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  SESSION_HINT_COOKIE,
  type AuthUser,
} from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, Public } from './decorators.js';
import { OtpService } from './otp.service.js';
import { TokenService, type TokenPair } from './token.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  private setCookies(reply: FastifyReply, pair: TokenPair) {
    const base = {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      // Lax: کوکی با ناوبری عادی می‌رود ولی با درخواست cross-site (CSRF) نه
      sameSite: 'lax' as const,
      ...(this.env.COOKIE_DOMAIN ? { domain: this.env.COOKIE_DOMAIN } : {}),
    };
    reply.setCookie(ACCESS_COOKIE, pair.accessToken, {
      ...base,
      path: '/',
      maxAge: ACCESS_TTL_SECONDS,
    });
    // توکن نوسازی فقط برای مسیرهای auth ارسال می‌شود، نه همه‌ی درخواست‌ها
    reply.setCookie(REFRESH_COOKIE, pair.refreshToken, {
      ...base,
      path: '/v1/auth',
      maxAge: REFRESH_TTL_SECONDS,
    });
    reply.setCookie(SESSION_HINT_COOKIE, '1', {
      ...base,
      httpOnly: false,
      path: '/',
      maxAge: REFRESH_TTL_SECONDS,
    });
  }

  private clearCookies(reply: FastifyReply) {
    reply.clearCookie(ACCESS_COOKIE, { path: '/' });
    reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    reply.clearCookie(SESSION_HINT_COOKIE, { path: '/' });
  }

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ارسال کد یکبارمصرف به موبایل' })
  requestOtp(@Body(new ZodValidationPipe(requestOtpSchema)) body: RequestOtpInput) {
    return this.otp.request(body.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({ summary: 'تأیید کد و ورود (کوکی httpOnly)' })
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpInput,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.otp.verify(body.phone, body.code);
    const { user, pair } = await this.auth.loginOrRegister(body.phone);
    this.setCookies(reply, pair);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'نوسازی نشست با توکن نوسازی (چرخشی)' })
  async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('نشست منقضی شده است');
    try {
      const { user, pair } = await this.auth.refresh(token);
      this.setCookies(reply, pair);
      return { user };
    } catch (error) {
      this.clearCookies(reply);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'خروج و باطل‌سازی توکن نوسازی' })
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await this.tokens.revokeRefresh(token);
    this.clearCookies(reply);
  }

  @Get('me')
  @ApiOperation({ summary: 'کاربر فعلی' })
  async me(@CurrentUser({ required: true }) current: AuthUser | undefined) {
    const user = await this.auth.getUser(current!.id);
    if (!user) throw new NotFoundException();
    return { user };
  }

  @Patch('me')
  @ApiOperation({ summary: 'ویرایش پروفایل (نام و ایمیل)' })
  async updateMe(
    @CurrentUser({ required: true }) current: AuthUser | undefined,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return { user: await this.auth.updateProfile(current!.id, body) };
  }
}