/** زبان‌های مشاور (هم‌خوان با AGENT_LANGUAGES در shared؛ اینجا جداست تا کلاینت zod را وارد bundle نکند) */
export const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'fa', label: 'فارسی' },
  { code: 'en', label: 'انگلیسی' },
  { code: 'ar', label: 'عربی' },
  { code: 'ru', label: 'روسی' },
  { code: 'hi', label: 'هندی' },
  { code: 'ur', label: 'اردو' },
  { code: 'tr', label: 'ترکی' },
];