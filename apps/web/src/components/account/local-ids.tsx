'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * فهرست شناسه‌های ذخیره‌شده در مرورگر (مقایسه، بازدیدهای اخیر) فقط در localStorage است، پس سرور آن را
 * نمی‌بیند. این جزیره آن را به URL (?ids=a,b) منتقل می‌کند تا صفحه در سرور رندر شود و لینک قابل اشتراک باشد.
 * اگر چیزی ذخیره نشده باشد، `empty` (حالت خالی سرور-رندر) نمایش داده می‌شود.
 */
export function LocalIdsRedirect({
  storageKey,
  max,
  basePath,
  empty,
}: {
  storageKey: string;
  max: number;
  basePath: string;
  empty: ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let ids: string[] = [];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      /* حالت خصوصی مرورگر */
    }
    if (ids.length > 0) router.replace(`${basePath}?ids=${ids.slice(0, max).join(',')}`);
    else queueMicrotask(() => setChecked(true));
  }, [storageKey, max, basePath, router]);

  return checked ? <>{empty}</> : <p className="py-16 text-center text-base text-muted">در حال بارگذاری…</p>;
}

/** پاک کردن فهرست محلی و برگشت به حالت خالی */
export function ClearLocalIds({
  storageKey,
  basePath,
  label,
}: {
  storageKey: string;
  basePath: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.removeItem(storageKey);
          window.dispatchEvent(new Event('ashian:compare'));
        } catch {
          /* حالت خصوصی مرورگر */
        }
        router.replace(basePath);
      }}
      className="text-sm text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
    >
      {label}
    </button>
  );
}