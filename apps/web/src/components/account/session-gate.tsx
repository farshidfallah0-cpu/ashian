'use client';

import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { refreshSession } from '../../lib/client-api';

/**
 * توکن دسترسی ۱۵ دقیقه عمر دارد و کوکی نوسازی فقط به API فرستاده می‌شود (نه به سرور Next)،
 * پس نوسازی باید در مرورگر انجام شود: اگر موفق بود صفحه را دوباره از سرور می‌گیریم،
 * وگرنه کاربر را به ورود می‌بریم و بعد از ورود به همین صفحه برمی‌گردد.
 */
export function SessionGate({ next }: { next?: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void refreshSession().then((ok) => {
      if (!alive) return;
      if (ok) {
        router.refresh();
        // اگر بعد از نوسازی هم همین‌جا ماندیم، نشست از سرور وب قابل تشخیص نیست
        setTimeout(() => alive && setFailed(true), 4000);
      } else {
        router.replace(`/login?next=${encodeURIComponent(next ?? window.location.pathname + window.location.search)}`);
      }
    });
    return () => {
      alive = false;
    };
  }, [next, router]);

  return (
    <div className="py-24 text-center" role="status">
      {failed ? (
        <>
          <p className="text-base text-ink-2">نشست شما تشخیص داده نشد.</p>
          <Link
            href={`/login?next=${encodeURIComponent(next ?? '/account')}`}
            className={`${buttonClasses({ variant: 'dark', size: 'md' })} mt-5`}
          >
            ورود دوباره
          </Link>
        </>
      ) : (
        <p className="text-base text-muted">در حال بررسی نشست…</p>
      )}
    </div>
  );
}