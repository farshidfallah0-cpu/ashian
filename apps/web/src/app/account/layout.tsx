import {
  Bell,
  BookmarkSimple,
  ChatCircleText,
  ClockCounterClockwise,
  GearSix,
  GitDiff,
  Heart,
  House,
  Medal,
  SquaresFour,
} from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountNav, type AccountNavItem } from '../../components/account/account-nav';
import { SessionGate } from '../../components/account/session-gate';
import { accountGet, getMe } from '../../lib/account-api';

export const metadata: Metadata = {
  title: { default: 'حساب من', template: '%s | حساب من' },
  robots: { index: false, follow: false },
};

/** پنل کاربر: دینامیک (کوکی نشست را می‌خواند) و بدون ایندکس */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me.ok) {
    return (
      <main id="main" className="container-page py-10">
        {me.status === 401 ? (
          <SessionGate />
        ) : (
          <p className="py-24 text-center text-base text-ink-2">
            پنل موقتاً در دسترس نیست؛ کمی بعد دوباره تلاش کنید.
          </p>
        )}
      </main>
    );
  }
  const { user } = me.data;
  const unread = await accountGet<{ unread: number }>('/v1/notifications/count');
  const items: AccountNavItem[] = [
    { href: '/account', label: 'نمای کلی', icon: <SquaresFour size={20} aria-hidden /> },
    { href: '/account/favorites', label: 'علاقه‌مندی‌ها', icon: <Heart size={20} aria-hidden /> },
    {
      href: '/account/saved-searches',
      label: 'جستجوهای ذخیره‌شده',
      icon: <BookmarkSimple size={20} aria-hidden />,
    },
    { href: '/compare', label: 'مقایسه', icon: <GitDiff size={20} aria-hidden /> },
    { href: '/account/listings', label: 'آگهی‌های من', icon: <House size={20} aria-hidden /> },
    {
      href: '/account/messages',
      label: 'پیام‌ها',
      icon: <ChatCircleText size={20} aria-hidden />,
    },
    {
      href: '/account/notifications',
      label: 'اعلان‌ها',
      icon: <Bell size={20} aria-hidden />,
      badge: unread.ok ? unread.data.unread : 0,
    },
    {
      href: '/account/recent',
      label: 'بازدیدهای اخیر',
      icon: <ClockCounterClockwise size={20} aria-hidden />,
    },
    ...(user.role === 'agent' || user.role === 'agency_manager'
      ? [{ href: user.role === 'agent' ? '/agent' : '/agency', label: user.role === 'agent' ? 'پنل مشاور' : 'پنل آژانس', icon: <Medal size={20} aria-hidden /> }]
      : []),
    { href: '/account/settings', label: 'تنظیمات حساب', icon: <GearSix size={20} aria-hidden /> },
  ];

  return (
    <main id="main" className="container-page grid gap-8 py-8 md:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      <aside>
        <div className="mb-5 hidden border-b border-line pb-5 lg:block">
          <p className="font-display text-lg leading-snug text-ink">{user.name ?? 'کاربر آشیان'}</p>
          <p dir="ltr" className="mt-0.5 text-start font-sans text-sm text-muted">
            +{user.phone}
          </p>
        </div>
        <AccountNav items={items} />
      </aside>
      <div className="min-w-0">{children}</div>
    </main>
  );
}
