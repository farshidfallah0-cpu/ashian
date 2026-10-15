'use client';

import { useEffect } from 'react';
import { apiRequest } from '../../lib/client-api';

/** چند لحظه بعد از دیدن فهرست، اعلان‌ها خوانده‌شده می‌شوند (تا کاربر نقطه‌ی «تازه» را یک بار ببیند) */
export function MarkRead({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void apiRequest('/v1/notifications/read', { method: 'POST', body: JSON.stringify({}) });
    }, 2500);
    return () => clearTimeout(timer);
  }, [enabled]);
  return null;
}