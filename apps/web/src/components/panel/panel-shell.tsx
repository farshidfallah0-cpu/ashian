import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AccountNav, type AccountNavItem } from '../account/account-nav';

/** چارچوب مشترک پنل مشاور و آژانس: ستون ناوبری + محتوا */
export function PanelShell({
  title,
  subtitle,
  items,
  children,
}: {
  title: string;
  subtitle?: string;
  items: AccountNavItem[];
  children: ReactNode;
}) {
  return (
    <main id="main" className="container-page grid gap-8 py-8 md:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      <aside>
        <div className="mb-5 hidden border-b border-line pb-5 lg:block">
          <p className="font-display text-lg leading-snug text-ink">{title}</p>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <AccountNav items={items} />
      </aside>
      <div className="min-w-0">{children}</div>
    </main>
  );
}

/** وقتی کاربر هنوز مشاور/مدیر آژانس نیست */
export function PanelInvite({ kind }: { kind: 'agent' | 'agency' }) {
  return (
    <main id="main" className="container-page py-16 md:py-24">
      <div className="max-w-xl">
        <h1 className="font-display text-3xl text-ink">
          {kind === 'agent' ? 'هنوز به‌عنوان مشاور ثبت‌نام نکرده‌اید' : 'شما آژانسی ندارید'}
        </h1>
        <p className="mt-3 text-base text-ink-2">
          {kind === 'agent'
            ? 'با شماره‌ی مجوز (BRN) ثبت‌نام کنید تا داشبورد آمار، صندوق سرنخ و مدیریت آگهی‌ها فعال شود.'
            : 'آژانس بسازید تا تیم مشاوران و آمار تجمیعی را مدیریت کنید.'}
        </p>
        <Link
          href={kind === 'agent' ? '/agents/join' : '/agency/new'}
          className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-6`}
        >
          {kind === 'agent' ? 'ثبت‌نام مشاور' : 'ساخت آژانس'}
        </Link>
      </div>
    </main>
  );
}