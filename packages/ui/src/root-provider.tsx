'use client';

import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';

/**
 * provider سبک ریشه‌ی سایت: فقط جهت راست‌چین برای کامپوننت‌های Radix.
 * عمداً Tooltip، Toast و motion را ندارد تا صفحه‌های عمومی (مثل صفحه‌ی اصلی) bundle کوچک بمانند.
 * صفحه‌ای که این‌ها را لازم دارد خودش `UIProvider` کامل را دور محتوایش می‌گذارد (providerها تودرتو می‌شوند).
 */
export function RootProvider({ children }: { children: ReactNode }) {
  return <Direction.Provider dir="rtl">{children}</Direction.Provider>;
}
