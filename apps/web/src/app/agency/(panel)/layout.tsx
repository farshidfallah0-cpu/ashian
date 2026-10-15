import { Buildings, ChartLineUp, ChatCircleText, GearSix, UserCircle } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { AccountNavItem } from '../../../components/account/account-nav';
import { SessionGate } from '../../../components/account/session-gate';
import { PanelInvite, PanelShell } from '../../../components/panel/panel-shell';
import { getPanelMe } from '../../../lib/panel';

export const metadata: Metadata = {
  title: { default: 'پنل آژانس', template: '%s | پنل آژانس' },
  robots: { index: false, follow: false },
};

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const me = await getPanelMe();
  if (!me.ok) {
    return (
      <main id="main" className="container-page py-10">
        {me.status === 401 ? <SessionGate /> : <p className="py-24 text-center text-base text-ink-2">پنل موقتاً در دسترس نیست.</p>}
      </main>
    );
  }
  if (!me.data.managedAgency) return <PanelInvite kind="agency" />;

  const items: AccountNavItem[] = [
    { href: '/agency', label: 'آمار و تیم', icon: <ChartLineUp size={20} aria-hidden /> },
    { href: '/agency/leads', label: 'سرنخ‌های تیم', icon: <ChatCircleText size={20} aria-hidden /> },
    { href: '/agency/settings', label: 'مشخصات آژانس', icon: <GearSix size={20} aria-hidden /> },
    ...(me.data.agent ? [{ href: '/agent', label: 'پنل مشاور', icon: <UserCircle size={20} aria-hidden /> }] : []),
    { href: '/account', label: 'حساب من', icon: <Buildings size={20} aria-hidden /> },
  ];
  return (
    <PanelShell title="پنل آژانس" subtitle={me.data.managedAgency.name} items={items}>
      {children}
    </PanelShell>
  );
}