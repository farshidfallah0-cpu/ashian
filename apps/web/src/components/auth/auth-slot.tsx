'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { sessionStore } from '../../lib/client-api';

/**
 * هدر ISR است و نباید کوکی بخواند (کل سایت دینامیک می‌شد). این جزیره‌ی کوچک با نشانگر «وارد شده‌ام»
 * (کوکی غیر httpOnly) یکی از دو گره‌ی سرور-رندر را نشان می‌دهد؛ بدون هیچ درخواست شبکه.
 */
export function AuthSlot({ loggedOut, loggedIn }: { loggedOut: ReactNode; loggedIn: ReactNode }) {
  const active = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.snapshot,
    sessionStore.serverSnapshot,
  );
  return <>{active ? loggedIn : loggedOut}</>;
}
