import { infraEnvSchema } from '@ashian/infra';
import { parseEnv } from '@ashian/shared/env';
import { z } from 'zod';

export const workerEnvSchema = infraEnvSchema.extend({
  /** فاصله‌ی محاسبه‌ی آمار و نشان مشاوران (ثانیه) */
  AGENT_STATS_TICK_SECONDS: z.coerce.number().int().min(5).default(3600),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(4),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const loadWorkerEnv = () => parseEnv(workerEnvSchema);
