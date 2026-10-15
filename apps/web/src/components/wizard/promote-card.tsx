'use client';

import { buttonClasses } from '@ashian/ui';
import { formatPrice } from '@ashian/shared';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/client-api';

interface Pack {
  days: number;
  price: number;
}

/**
 * ارتقا به «ویژه» از طریق لایه‌ی پرداخت: سفارش روی سرور ساخته می‌شود و کاربر به آدرس درگاه
 * (در توسعه، درگاه ساختگی) می‌رود. قیمت‌ها فقط سمت سرور تعیین می‌شود.
 * در هر صفحه‌ی نتایج حداکثر ۳ آگهی ویژه نمایش داده می‌شود.
 */
export function PromoteCard({ publicId }: { publicId: string }) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiRequest('/v1/promotions/featured').then(async (r) => {
      if (!alive || !r?.ok) return;
      const list = (await r.json()) as Pack[];
      setPacks(list);
      setDays(list[0]?.days ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function start() {
    if (!days) return;
    setBusy(true);
    setError(null);
    const response = await apiRequest(`/v1/listings/${publicId}/promote`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
    if (!response?.ok) {
      setBusy(false);
      return setError('شروع پرداخت ناموفق بود؛ دوباره تلاش کنید.');
    }
    window.location.href = ((await response.json()) as { redirectUrl: string }).redirectUrl;
  }

  if (packs.length === 0) return null;
  return (
    <section className="rounded-sm border border-line p-6">
      <h2 className="font-display text-xl text-ink">آگهی را «ویژه» کنید</h2>
      <p className="mt-1.5 text-base text-muted">
        آگهی ویژه بالای نتایج با برچسب «ویژه» نمایش داده می‌شود. این برچسب تأیید یا رتبه‌ی کیفیت نیست.
      </p>
      <div role="radiogroup" aria-label="مدت ارتقا" className="mt-5 grid gap-2 sm:grid-cols-3">
        {packs.map((p) => (
          <label
            key={p.days}
            className={`cursor-pointer rounded-sm border px-4 py-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
              days === p.days ? 'border-ink bg-surface' : 'border-line-strong hover:border-ink'
            }`}
          >
            <input type="radio" name="days" checked={days === p.days} onChange={() => setDays(p.days)} className="sr-only" />
            <span className="block text-base font-medium text-ink">{p.days.toLocaleString('fa-IR')} روز</span>
            <span className="text-sm text-muted">{formatPrice(p.price)}</span>
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void start()} aria-busy={busy || undefined} className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-5`}>
        ادامه به پرداخت
      </button>
    </section>
  );
}