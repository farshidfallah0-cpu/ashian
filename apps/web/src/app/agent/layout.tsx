import { Briefcase, ChartLineUp, ChatCircleText, Buildings, House, UserCircle } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { AccountNavItem } from '../../components/account/account-nav';
import { SessionGate } from '../../components/account/session-gate';
import { PanelInvite, PanelShell } from '../../components/panel/panel-shell';
import { getPanelMe } from '../../lib/panel';

export const metadata: Metadata = {
  title: { default: 'پنل مشاور', template: '%s | پنل مشاور' },
  robots: { index: false, follow: false },
};

export default async function AgentLayout({ children }: { children: ReactNode }) {
  const me = await getPanelMe();
  if (!me.ok) {
    return (
      <main id="main" className="container-page py-10">
        {me.status === 401 ? <SessionGate /> : <p className="py-24 text-center text-base text-ink-2">پنل موقتاً در دسترس نیست.</p>}
      </main>
    );
  }
  if (!me.data.agent) return <PanelInvite kind="agent" />;

  const items: AccountNavItem[] = [
    { href: '/agent', label: 'داشبورد', icon: <ChartLineUp size={20} aria-hidden /> },
    { href: '/agent/listings', label: 'آگهی‌های من', icon: <House size={20} aria-hidden /> },
    { href: '/agent/leads', label: 'سرنخ‌ها', icon: <ChatCircleText size={20} aria-hidden /> },
    { href: '/agent/profile', label: 'پروفایل مشاور', icon: <UserCircle size={20} aria-hidden /> },
    ...(me.data.managedAgency
      ? [{ href: '/agency', label: 'پنل آژانس', icon: <Buildings size={20} aria-hidden /> }]
      : []),
    { href: '/account', label: 'حساب من', icon: <Briefcase size={20} aria-hidden /> },
  ];
  return (
    <PanelShell title="پنل مشاور" subtitle={me.data.agent.agency?.name} items={items}>
      {children}
    </PanelShell>
  );
}