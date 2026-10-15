import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { MockPaymentProvider, PAYMENT_PROVIDER } from './payment.provider.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [ListingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }],
})
export class PaymentsModule {}