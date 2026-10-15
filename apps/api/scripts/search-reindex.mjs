// ساخت دوباره‌ی کامل ایندکس جستجو: pnpm search:reindex
// فقط job را در صف می‌گذارد: در حالت full توسط worker و در حالت lite توسط خود API اجرا می‌شود.
// ایندکس تازه جدا ساخته و اتمیک جایگزین می‌شود؛ جستجو در این مدت از ایندکس قبلی جواب می‌دهد.
// پیشنهاد: هر شب یک بار (cron) تا امتیاز تازگی آگهی‌ها و تعداد آگهی پیشنهادها تازه شود.
import { createQueueClient, infraEnvSchema } from '@ashian/infra';
import { loadRootEnv, parseEnv } from '@ashian/shared/env';

loadRootEnv();
const env = parseEnv(infraEnvSchema);
const queue = createQueueClient(env);

const jobId = await queue.enqueue(
  'search.reindex',
  { reason: 'دستور pnpm search:reindex' },
  { attempts: 1, removeOnComplete: true },
);
console.log(
  `reindex در صف قرار گرفت (job ${jobId}). پیشرفت در لاگ ${env.INFRA_MODE === 'lite' ? 'API' : 'worker'}.`,
);
await queue.close();
process.exit(0);
