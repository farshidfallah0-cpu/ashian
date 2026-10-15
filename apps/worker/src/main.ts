import { createDb } from '@ashian/db';
import { createCache, createQueueClient, createStorage, createWorkers } from '@ashian/infra';
import {
  alertJobs,
  consoleNotifier,
  createIndexer,
  createSearchEngine,
  searchJobs,
  startAlertScheduler,
} from '@ashian/search';
import { loadRootEnv } from '@ashian/shared/env';
import { loadWorkerEnv } from './env.js';
import { analyticsJobs } from './jobs/analytics.js';
import { mediaJobs } from './jobs/media.js';
import { systemJobs } from './jobs/system.js';
import { createLogger } from './logger.js';

loadRootEnv();
const env = loadWorkerEnv();
const logger = createLogger(env.LOG_LEVEL, env.NODE_ENV === 'development');

const db = createDb({
  url: env.DATABASE_URL,
  replicaUrl: env.DATABASE_REPLICA_URL,
  poolMax: env.DATABASE_POOL_MAX,
  applicationName: 'ashian-worker',
});
const cache = await createCache(env);
const storage = await createStorage(env);
const queue = createQueueClient(env);

// ایندکس جستجو در حالت full روی Typesense است و worker آن را به‌روز می‌کند.
// در حالت lite ایندکس درون‌حافظه‌ی پروسه‌ی API است (worker به آن دسترسی ندارد)، پس خود API صف search را مصرف می‌کند.
const searchEngine = env.INFRA_MODE === 'full' ? await createSearchEngine(env) : null;
if (searchEngine) await searchEngine.ensureReady();
const indexer = searchEngine ? createIndexer({ db, engine: searchEngine, logger }) : null;
const searchHandlers = searchEngine && indexer
  ? {
      ...searchJobs({ indexer, logger }),
      // هشدار جستجوهای ذخیره‌شده به موتور جستجو نیاز دارد (در lite داخل API اجرا می‌شود)
      ...alertJobs({
        db,
        engine: searchEngine,
        logger,
        siteUrl: env.WEB_URL,
        indexer,
        notifier: consoleNotifier(logger),
      }),
    }
  : {};
const stopScheduler = searchEngine
  ? startAlertScheduler({ queue, intervalSeconds: env.ALERT_TICK_SECONDS, logger })
  : () => undefined;

// آمار و نشان مشاوران: ساعتی (jobId یکتا برای هر بازه؛ بدون job تأخیری که در lite صف را قفل می‌کند)
const agentTick = async () => {
  const bucket = String(Math.floor(Date.now() / (env.AGENT_STATS_TICK_SECONDS * 1000)));
  await queue
    .enqueue('analytics.refresh-agents', { tick: bucket }, { jobId: `agents-${bucket}`, attempts: 1, removeOnComplete: true, removeOnFail: true })
    .catch((error) => logger.warn({ err: String(error) }, 'صف کردن محاسبه‌ی مشاوران ناموفق بود'));
};
void agentTick();
const agentTimer = setInterval(() => void agentTick(), env.AGENT_STATS_TICK_SECONDS * 1000);
agentTimer.unref();

const { workers, close } = createWorkers(
  env,
  {
    ...systemJobs(logger),
    ...mediaJobs({ db, storage, queue, logger }),
    ...analyticsJobs({ db, cache }),
    ...searchHandlers,
  },
  // پردازش عکس CPU-سنگین است؛ هم‌زمانی کم تا API و دیگر jobها گرسنه نمانند
  { concurrency: { system: 1, media: 2, analytics: 8, search: 4, notifications: 1 } },
);

for (const worker of workers) {
  worker.on('failed', (job, error) =>
    logger.error({ queue: worker.name, jobId: job?.id, name: job?.name, err: error }, 'job ناموفق'),
  );
  worker.on('error', (error) => logger.error({ queue: worker.name, err: error }, 'خطای worker'));
}

logger.info({ mode: env.INFRA_MODE, queues: workers.map((w) => w.name) }, 'worker آماده است');

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'در حال بستن worker؛ jobهای در حال اجرا تمام می‌شوند');
  stopScheduler();
  clearInterval(agentTimer);
  await close();
  await queue.close();
  await searchEngine?.close();
  await cache.close();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
