'use client';

import { formatPrice } from '@ashian/shared';
import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../../../lib/client-api';

interface Order {
  id: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  days: number;
  amount: number;
  listing: { publicId: string; title: string };
}

export function MockCheckout({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiRequest(`/v1/orders/${orderId}`).then(async (r) => {
      if (!alive) return;
      if (r?.ok) setOrder((await r.json()) as Order);
      else setMissing(true);
    });
    return () => {
      alive = false;
    };
  }, [orderId]);

  async function finish(outcome: 'paid' | 'failed') {
    setBusy(true);
    const r = await apiRequest(`/v1/payments/mock/${orderId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    });
    setBusy(false);
    if (r?.ok) setOrder((await r.json()) as Order);
  }

  if (missing) return <p className="text-base text-ink-2">سفارش پیدا نشد یا به شما تعلق ندارد.</p>;
  if (!order) return <div className="skeleton h-48 max-w-lg" aria-hidden />;

  return (
    <div className="max-w-lg">
      <p className="mb-6 rounded-sm bg-accent-soft px-4 py-2.5 text-sm text-accent-active">
        درگاه آزمایشی — فقط محیط توسعه. هیچ پولی برداشت نمی‌شود.
      </p>
      <h1 className="font-display text-3xl text-ink">پرداخت ارتقای ویژه</h1>
      <dl className="mt-6 border-y border-line">
        <div className="flex justify-between gap-4 border-b border-line py-3.5 text-base">
          <dt className="text-muted">آگهی</dt>
          <dd className="text-ink">{order.listing.title}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-line py-3.5 text-base">
          <dt className="text-muted">مدت</dt>
          <dd className="text-ink">{order.days.toLocaleString('fa-IR')} روز</dd>
        </div>
        <div className="flex justify-between gap-4 py-3.5 text-base">
          <dt className="text-muted">مبلغ</dt>
          <dd className="font-display text-xl text-ink">{formatPrice(order.amount)}</dd>
        </div>
      </dl>

      {order.status === 'pending' ? (
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => void finish('paid')} className={buttonClasses({ variant: 'primary', size: 'lg' })}>
            پرداخت موفق
          </button>
          <button type="button" disabled={busy} onClick={() => void finish('failed')} className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
            پرداخت ناموفق
          </button>
        </div>
      ) : (
        <div className="mt-8">
          <p role="status" className={`text-lg ${order.status === 'paid' ? 'text-verified' : 'text-danger'}`}>
            {order.status === 'paid' ? 'پرداخت انجام شد؛ آگهی ویژه است.' : 'پرداخت انجام نشد.'}
          </p>
          <Link href="/account/listings" className={`${buttonClasses({ variant: 'dark', size: 'md' })} mt-4`}>
            آگهی‌های من
          </Link>
        </div>
      )}
    </div>
  );
}