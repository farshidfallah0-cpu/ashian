'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface AccountNavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** تعداد (مثل اعلان خوانده‌نشده) */
  badge?: number;
}

/** ناوبری پنل: دسکتاپ ستون کناری، موبایل نوار افقی قابل اسکرول. آیکون‌ها از سرور می‌آیند. */
export function AccountNav({ items }: { items: AccountNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="پنل کاربر">
      <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {items.map((item) => {
          const active =
            item.href === '/account' ? pathname === '/account' : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`flex h-11 items-center gap-3 rounded-sm px-3.5 text-base transition-colors duration-150 ${
                  active ? 'bg-surface text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'
                }`}
              >
                <span className={active ? 'text-brand' : 'text-muted'}>{item.icon}</span>
                {item.label}
                {item.badge ? (
                  <span className="ms-auto min-w-5 rounded-full bg-accent px-1.5 text-center font-sans text-xs leading-5 text-white">
                    {item.badge.toLocaleString('fa-IR')}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}