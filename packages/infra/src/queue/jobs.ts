/**
 * فهرست تایپ‌شده‌ی صف‌ها و jobها. هر job جدید فقط اینجا تعریف می‌شود
 * تا تولیدکننده (API) و مصرف‌کننده (worker) روی یک قرارداد توافق داشته باشند.
 */

export const QUEUE_NAMES = ['system', 'media', 'search', 'notifications', 'analytics'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

export interface JobPayloads {
  /** job نمونه برای بررسی سلامت زنجیره‌ی صف */
  'system.heartbeat': { sentAt: string; source: string };
  /** پردازش عکس آپلودشده: ساخت اندازه‌ها، blurhash، حذف EXIF */
  'media.process': { mediaId: string };
  /** همگام‌سازی یک آگهی با ایندکس جستجو؛ وضعیت فعلی از دیتابیس خوانده می‌شود (شناسه‌ی داخلی آگهی) */
  'search.sync-listing': { listingId: string };
  /** ساخت دوباره‌ی کامل ایندکس و جابه‌جایی اتمیک */
  'search.reindex': { reason: string };
  /** بازسازی پیشنهادهای خودکار (تعداد آگهی هر محله/مشاور) */
  'search.refresh-suggestions': Record<string, never>;
  /** افزودن بازدید آگهی؛ تجمیع روزانه در worker (نه نوشتن مستقیم هر بازدید) */
  /** بررسی دوره‌ای هشدار جستجوهای ذخیره‌شده؛ 	ick برای یکتایی (deduplicate) بین چند نمونه */
  'notifications.run-alerts': { tick: string };
  /** محاسبه‌ی دوره‌ای آمار و نشان «مشاور برتر»؛ 	ick برای یکتایی بین چند نمونه */
  'analytics.refresh-agents': { tick: string };
  'analytics.view': { listingId: string; day: string; visitorHash: string };
}

export type JobName = keyof JobPayloads;

/** صف هر job از پیشوند نامش مشخص می‌شود: «media.process» → صف media */
export function queueOf(name: JobName): QueueName {
  const prefix = name.split('.')[0] as QueueName;
  if (!QUEUE_NAMES.includes(prefix)) throw new Error(`صف نامعتبر برای job: ${name}`);
  return prefix;
}
