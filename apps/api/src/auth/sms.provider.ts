import { Injectable, Logger } from '@nestjs/common';

/** رابط ارسال پیامک؛ سرویس‌دهنده‌ی واقعی (Twilio، Unifonic …) در production جایگزین می‌شود */
export interface SmsProvider {
  readonly kind: string;
  send(phone: string, text: string): Promise<void>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** فقط توسعه: پیامک را در لاگ چاپ می‌کند */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly kind = 'console';
  private readonly logger = new Logger('SMS');

  async send(phone: string, text: string): Promise<void> {
    this.logger.log(`→ +${phone}: ${text}`);
  }
}
