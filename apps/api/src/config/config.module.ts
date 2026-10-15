import { Global, Module, type DynamicModule } from '@nestjs/common';
import { API_ENV, type ApiEnv } from './env.js';

@Global()
@Module({})
export class ConfigModule {
  static forRoot(env: ApiEnv): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: API_ENV, useValue: env }],
      exports: [API_ENV],
    };
  }
}
