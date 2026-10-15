'use client';

import { useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const RECENT_KEY = 'ashian:recent';
const RECENT_MAX = 20;

/**
 * بعد از نمایش صفحه یک بازدید ثبت می‌کند (API فقط آن را در صف می‌گذارد) و آگهی را در فهرست
 * «بازدیدهای اخیر» مرورگر نگه می‌دارد. صفحه ISR است و سرور Next هیچ‌وقت IP بازدیدکننده را
 * نمی‌بیند، پس شمارش باید از مرورگر باشد تا «بازدید یکتا» درست حساب شود.
 */
export function ViewBeacon({ publicId }: { publicId: string }) {
  useEffect(() => {
    fetch(`${API}/v1/listings/${publicId}/view`, { method: 'POST', keepalive: true }).catch(
      () => undefined,
    );
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      const list = Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
      localStorage.setItem(
        RECENT_KEY,
        JSON.stringify([publicId, ...list.filter((id) => id !== publicId)].slice(0, RECENT_MAX)),
      );
    } catch {
      /* حالت خصوصی مرورگر */
    }
  }, [publicId]);
  return null;
}
