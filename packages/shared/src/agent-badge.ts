/**
 * معیارهای نشان «مشاور برتر». همه قابل تنظیم‌اند (مقادیر پیش‌فرض اینجاست و job محاسبه
 * می‌تواند آن‌ها را override کند؛ پنل ادمین در مرحله‌ی ۱۲ همین ساختار را ویرایش می‌کند).
 * نشان فقط بر پایه‌ی همین معیارهاست، نه پرداخت.
 */
export interface AgentBadgeCriteria {
  /** حداقل امتیاز کاربران (۰ تا ۵) */
  minRating: number;
  /** حداقل تعداد نظر برای معتبر بودن امتیاز */
  minReviews: number;
  /** حداکثر میانگین زمان پاسخ به سرنخ (دقیقه)؛ اگر هنوز داده نیست مانع نمی‌شود */
  maxResponseMinutes: number;
  /** حداقل میانگین امتیاز کیفیت آگهی‌های فعال (۰ تا ۱۰۰) */
  minAvgQuality: number;
  /** حداقل تعداد آگهی فعال */
  minActiveListings: number;
  /** حداکثر گزارش تخلف تأییدشده در پنجره‌ی بررسی */
  maxViolations: number;
}

export const AGENT_BADGE: AgentBadgeCriteria = {
  minRating: 4.5,
  minReviews: 10,
  maxResponseMinutes: 60,
  minAvgQuality: 55,
  minActiveListings: 3,
  maxViolations: 0,
};

export interface AgentBadgeInput {
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  /** null = هنوز پاسخی ثبت نشده */
  avgResponseMinutes: number | null;
  avgQuality: number | null;
  activeListings: number;
  violations: number;
}

/** دلایل نگرفتن نشان (برای نمایش به خود مشاور: «چه چیزی کم دارم؟») */
export function topAgentGaps(
  input: AgentBadgeInput,
  criteria: AgentBadgeCriteria = AGENT_BADGE,
): string[] {
  const gaps: string[] = [];
  if (!input.verified) gaps.push('مجوز مشاور (BRN) هنوز تأیید نشده است');
  if (input.rating === null || input.rating < criteria.minRating || input.reviewCount < criteria.minReviews) {
    gaps.push(`امتیاز ${criteria.minRating} یا بالاتر با حداقل ${criteria.minReviews} نظر لازم است`);
  }
  if (input.avgResponseMinutes !== null && input.avgResponseMinutes > criteria.maxResponseMinutes) {
    gaps.push(`میانگین زمان پاسخ باید حداکثر ${criteria.maxResponseMinutes} دقیقه باشد`);
  }
  if (input.avgQuality === null || input.avgQuality < criteria.minAvgQuality) {
    gaps.push(`میانگین کیفیت آگهی‌ها باید حداقل ${criteria.minAvgQuality} باشد (عکس بیشتر، توضیحات کامل‌تر، Permit)`);
  }
  if (input.activeListings < criteria.minActiveListings) {
    gaps.push(`حداقل ${criteria.minActiveListings} آگهی فعال لازم است`);
  }
  if (input.violations > criteria.maxViolations) gaps.push('گزارش تخلف تأییدشده دارید');
  return gaps;
}

export function isTopAgent(
  input: AgentBadgeInput,
  criteria: AgentBadgeCriteria = AGENT_BADGE,
): boolean {
  return topAgentGaps(input, criteria).length === 0;
}
