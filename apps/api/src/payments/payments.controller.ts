import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { PublicIdPipe, UuidPipe } from '../common/pipes.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { API_ENV, type ApiEnv } from '../config/env.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment.provider.js';
import { PaymentsService } from './payments.service.js';

const promoteSchema = z.object({ days: z.number().int() });
const outcomeSchema = z.object({ outcome: z.enum(['paid', 'failed']) });

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly service: PaymentsService,
  ) {}

  @Public()
  @Get('promotions/featured')
  @ApiOperation({ summary: 'بسته‌های ارتقای ویژه و قیمت‌ها' })
  packages() {
    return this.service.packages();
  }

  @Post('listings/:publicId/promote')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'شروع ارتقای ویژه (ساخت سفارش و آدرس پرداخت)' })
  promote(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('publicId', new PublicIdPipe()) publicId: string,
    @Body(new ZodValidationPipe(promoteSchema)) body: z.infer<typeof promoteSchema>,
  ) {
    return this.service.promote(user!, publicId, body.days);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'وضعیت سفارش' })
  order(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
  ) {
    return this.service.getOrder(user!, id);
  }

  /** فقط درگاه ساختگی توسعه: پایان پرداخت را شبیه‌سازی می‌کند (در production وجود ندارد) */
  @Post('payments/mock/:id/complete')
  @HttpCode(200)
  async mockComplete(
    @CurrentUser({ required: true }) user: AuthUser | undefined,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(outcomeSchema)) body: z.infer<typeof outcomeSchema>,
  ) {
    if (this.provider.kind !== 'mock' || this.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    // فقط صاحب سفارش (getOrder دسترسی را بررسی می‌کند)
    const order = await this.service.getOrder(user!, id);
    if (order.provider !== 'mock') throw new BadRequestException('این سفارش با درگاه دیگری است');
    if (body.outcome === 'paid') await this.service.markPaid(id);
    else await this.service.markFailed(id);
    return this.service.getOrder(user!, id);
  }
}