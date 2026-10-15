import { Inject, Injectable } from '@nestjs/common';
import { API_ENV, type ApiEnv } from '../config/env.js';

export interface CheckoutRequest {
  orderId: string;
  /** مبلغ به واحد پول بازار */
  amount: number;
  currency: string;
  description: string;
}

export interface CheckoutSession {
  /** شناسه‌ی سفارش نزد درگاه (برای پیگیری و webhook) */
  providerRef: string;
  /** کاربر برای پرداخت به این آدرس می‌رود */
  redirectUrl: string;
}

/**
 * لایه‌ی انتزاعی درگاه پرداخت. درگاه واقعی (Stripe، Network International، …) فقط همین
 * interface را پیاده می‌کند و در `PAYMENT_PROVIDER` ثبت می‌شود؛ منطق برنامه (سفارش، اعطای ارتقا)
 * به درگاه خاصی وابسته نیست و فقط با `PaymentsService.markPaid` کار می‌کند (webhook همان را صدا می‌زند).
 */
export interface PaymentProvider {
  readonly kind: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/** فقط توسعه: کاربر به یک صفحه‌ی ساختگی می‌رود و «پرداخت موفق/ناموفق» را خودش می‌زند */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly kind = 'mock';

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    return {
      providerRef: `mock_${request.orderId}`,
      redirectUrl: `${this.env.WEB_URL}/pay/mock/${request.orderId}`,
    };
  }
}