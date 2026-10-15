import type { JobHandlers } from '@ashian/infra';
import type { Logger } from '../logger.js';

/** صف نمونه: تأخیر بین ارسال از API و پردازش در worker را گزارش می‌کند */
export function systemJobs(logger: Logger): JobHandlers {
  return {
    'system.heartbeat': async (data, job) => {
      const latencyMs = Date.now() - new Date(data.sentAt).getTime();
      logger.info({ jobId: job.id, source: data.source, latencyMs }, 'heartbeat دریافت شد');
      return { receivedAt: new Date().toISOString(), latencyMs };
    },
  };
}
