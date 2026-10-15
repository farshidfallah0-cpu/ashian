'use client';

import { useRouter } from 'next/navigation';

const KEY = 'ashian:compare';

/** حذف یک ملک از مقایسه: هم URL و هم فهرست مرورگر (که دکمه‌ی «مقایسه» در صفحه‌ی آگهی می‌خواند) */
export function CompareRemove({
  publicId,
  ids,
  title,
}: {
  publicId: string;
  ids: string[];
  title: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={`حذف «${title}» از مقایسه`}
      onClick={() => {
        const rest = ids.filter((id) => id !== publicId);
        try {
          localStorage.setItem(KEY, JSON.stringify(rest));
          window.dispatchEvent(new Event('ashian:compare'));
        } catch {
          /* حالت خصوصی مرورگر */
        }
        router.replace(rest.length ? `/compare?ids=${rest.join(',')}` : '/compare');
      }}
      className="text-sm text-muted underline decoration-line-strong underline-offset-[6px] hover:text-danger hover:decoration-danger"
    >
      حذف
    </button>
  );
}