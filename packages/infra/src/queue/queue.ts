import {
  createPostgresBackend,
  Queue,
  Worker,
  withBackend,
  type Job,
  type JobsOptions,
  type WorkerOptions,
} from 'bullmq';
import { Redis } from 'ioredis';
import type { InfraEnv } from '../env.js';
import { QUEUE_NAMES, queueOf, type JobName, type JobPayloads, type QueueName } from './jobs.js';

/**
 * BullMQ در هر دو حالت:
 * - full: روی Redis
 * - lite: روی PostgreSQL (همان سرور PGlite)
 *
 * نکته‌ی حالت lite: سرور PGlite همه‌ی اتصال‌ها را روی یک session اجرا می‌کند،
 * پس search_path نباید عوض شود؛ برای همین BullMQ در schema «public» است.
 * جدول‌های BullMQ نام مفرد دارند (job، event، ...) و با جدول‌های برنامه (جمع) تداخل ندارند.
 */

type AnyQueue = Queue;
type AnyWorker = Worker;

interface Backend {
  createQueue(name: QueueName): AnyQueue;
  createWorker(
    name: QueueName,
    processor: (job: Job) => Promise<unknown>,
    options: Partial<WorkerOptions>,
  ): AnyWorker;
  close(): Promise<void>;
}

function createBackend(env: InfraEnv): Backend {
  if (env.INFRA_MODE === 'lite') {
    const pg = withBackend(createPostgresBackend);
    const connection = {
      connectionString: env.DATABASE_URL,
      schema: 'public',
      migrate: true,
      max: 4,
    };
    return {
      createQueue: (name) => new pg.Queue(name, { connection }) as unknown as AnyQueue,
      createWorker: (name, processor, options) =>
        new pg.Worker(name, processor, { ...options, connection }) as unknown as AnyWorker,
      close: async () => {},
    };
  }

  // اتصال مشترک برای Queueها؛ Worker خودش اتصال blocking جدا می‌سازد
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return {
    createQueue: (name) => new Queue(name, { connection, prefix: 'ashian' }),
    createWorker: (name, processor, options) =>
      new Worker(name, processor, { ...options, connection, prefix: 'ashian' }),
    close: async () => {
      await connection.quit();
    },
  };
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3_600 },
};

/** سمت تولیدکننده (API): فقط اضافه کردن job */
export interface QueueClient {
  enqueue<K extends JobName>(name: K, data: JobPayloads[K], options?: JobsOptions): Promise<string>;
  counts(): Promise<Record<QueueName, Record<string, number>>>;
  close(): Promise<void>;
}

export function createQueueClient(env: InfraEnv): QueueClient {
  const backend = createBackend(env);
  const queues = new Map<QueueName, AnyQueue>();
  const get = (name: QueueName) => {
    let queue = queues.get(name);
    if (!queue) {
      queue = backend.createQueue(name);
      queues.set(name, queue);
    }
    return queue;
  };

  return {
    async enqueue(name, data, options) {
      const job = await get(queueOf(name)).add(name, data, { ...DEFAULT_JOB_OPTIONS, ...options });
      return String(job.id);
    },
    async counts() {
      const result = {} as Record<QueueName, Record<string, number>>;
      for (const name of QUEUE_NAMES) {
        result[name] = await get(name).getJobCounts('waiting', 'active', 'delayed', 'failed');
      }
      return result;
    },
    async close() {
      await Promise.all([...queues.values()].map((q) => q.close()));
      await backend.close();
    },
  };
}

export type JobHandler<K extends JobName> = (data: JobPayloads[K], job: Job) => Promise<unknown>;
export type JobHandlers = { [K in JobName]?: JobHandler<K> };

/** سمت مصرف‌کننده (worker): برای هر صف یک Worker که jobها را بر اساس نام پخش می‌کند */
export function createWorkers(
  env: InfraEnv,
  handlers: JobHandlers,
  options: { concurrency?: Partial<Record<QueueName, number>> } = {},
) {
  const backend = createBackend(env);
  const byQueue = new Map<QueueName, JobName[]>();
  for (const name of Object.keys(handlers) as JobName[]) {
    const queue = queueOf(name);
    byQueue.set(queue, [...(byQueue.get(queue) ?? []), name]);
  }

  const workers = [...byQueue.keys()].map((queue) =>
    backend.createWorker(
      queue,
      async (job) => {
        const handler = handlers[job.name as JobName] as JobHandler<JobName> | undefined;
        if (!handler) throw new Error(`handler برای ${job.name} ثبت نشده`);
        return handler(job.data as JobPayloads[JobName], job);
      },
      { concurrency: options.concurrency?.[queue] ?? 4 },
    ),
  );

  return {
    workers,
    async close() {
      await Promise.all(workers.map((w) => w.close()));
      await backend.close();
    },
  };
}
