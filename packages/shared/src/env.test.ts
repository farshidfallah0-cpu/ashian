import { describe, expect, it } from 'vitest';
import { baseEnvSchema, databaseEnvSchema, EnvValidationError, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('مقادیر پیش‌فرض را اعمال می‌کند', () => {
    const env = parseEnv(baseEnvSchema, {});
    expect(env).toEqual({ NODE_ENV: 'development', LOG_LEVEL: 'info', INFRA_MODE: 'lite' });
  });

  it('رشته‌ی خالی برای متغیر اختیاری undefined می‌شود', () => {
    const env = parseEnv(databaseEnvSchema, {
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      DATABASE_REPLICA_URL: '',
    });
    expect(env.DATABASE_REPLICA_URL).toBeUndefined();
    expect(env.DATABASE_POOL_MAX).toBe(10);
  });

  it('خطای خوانا با نام متغیر می‌دهد', () => {
    expect(() => parseEnv(baseEnvSchema, { INFRA_MODE: 'cloud' })).toThrow(EnvValidationError);
    try {
      parseEnv(databaseEnvSchema, {});
    } catch (e) {
      expect((e as EnvValidationError).issues[0]).toMatch(/^DATABASE_URL:/);
    }
  });
});
