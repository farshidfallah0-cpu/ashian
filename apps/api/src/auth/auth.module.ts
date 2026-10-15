import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OtpService } from './otp.service.js';
import { ConsoleSmsProvider, SMS_PROVIDER } from './sms.provider.js';
import { TokenService } from './token.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    TokenService,
    OtpService,
    AuthService,
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
    // نگهبان سراسری: هر مسیر که @Public نباشد نیاز به ورود دارد
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokenService, AuthService, SMS_PROVIDER],
})
export class AuthModule {}
