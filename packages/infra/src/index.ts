import { isAbsolute, join } from 'node:path';
import { findRepoRoot } from '@ashian/shared/env';
import type { Cache } from './cache/types.js';
import type { InfraEnv } from './env.js';
import type { ObjectStorage } from './storage/types.js';

export * from './cache/types.js';
export { MemoryCache } from './cache/memory-cache.js';
export * from './env.js';
export * from './media/process-image.js';
export * from './queue/jobs.js';
export * from './queue/queue.js';
export * from './storage/types.js';
export {
  createLocalUploadToken,
  verifyLocalUploadToken,
  type LocalUploadClaims,
} from './storage/local-storage.js';

/**
 * ساخت آداپتورها بر اساس INFRA_MODE.
 * کلاینت‌های سنگین (Redis، AWS SDK) فقط در حالت full بارگذاری می‌شوند.
 */

export async function createCache(env: InfraEnv): Promise<Cache> {
  if (env.INFRA_MODE === 'lite') {
    const { MemoryCache } = await import('./cache/memory-cache.js');
    return new MemoryCache();
  }
  const { RedisCache } = await import('./cache/redis-cache.js');
  return new RedisCache(env.REDIS_URL);
}

export async function createStorage(env: InfraEnv): Promise<ObjectStorage> {
  if (env.INFRA_MODE === 'lite') {
    const { LocalStorage } = await import('./storage/local-storage.js');
    const dir = isAbsolute(env.STORAGE_LOCAL_DIR)
      ? env.STORAGE_LOCAL_DIR
      : join(findRepoRoot(), env.STORAGE_LOCAL_DIR);
    return new LocalStorage(dir, env.API_URL, env.MEDIA_SIGNING_SECRET);
  }
  const { S3Storage } = await import('./storage/s3-storage.js');
  return new S3Storage({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
    publicUrl: env.S3_PUBLIC_URL,
  });
}
