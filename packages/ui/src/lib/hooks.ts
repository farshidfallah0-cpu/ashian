'use client';

import { useCallback, useSyncExternalStore } from 'react';

function useMatchMedia(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notify);
      return () => mql.removeEventListener('change', notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** کاربر در تنظیمات سیستم کاهش انیمیشن را روشن کرده است؟ */
export function useReducedMotion(): boolean {
  return useMatchMedia('(prefers-reduced-motion: reduce)', false);
}

/** صفحه‌ی کوچک (زیر ۷۶۸ پیکسل)؟ در SSR فرض می‌شود دسکتاپ نیست تا Sheet درست رندر شود */
export function useIsMobile(): boolean {
  return useMatchMedia('(max-width: 767px)', false);
}

/** هاور واقعی (ماوس)، نه لمس */
export function useCanHover(): boolean {
  return useMatchMedia('(hover: hover) and (pointer: fine)', true);
}
