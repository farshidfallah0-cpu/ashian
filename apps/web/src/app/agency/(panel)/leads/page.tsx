import type { InboxLead } from '@ashian/shared';
import { PanelHeading } from '../../../../components/account/account-card';
import { LeadsInbox } from '../../../../components/panel/leads-inbox';
import { accountGet, type ApiPage } from '../../../../lib/account-api';

export const metadata = { title: 'سرنخ‌های تیم' };

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

export default async function AgencyLeadsPage({ searchParams }: Props) {
  const { status = '', page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const ok = ['new', 'contacted', 'viewing', 'closed'].includes(status) ? status : '';
  const result = await accountGet<ApiPage<InboxLead>>(`/v1/agency/leads?page=${page}&pageSize=15${ok ? `&status=${ok}` : ''}`);
  return (
    <>
      <PanelHeading title="سرنخ‌های تیم" lead="سرنخ‌های همه‌ی مشاوران آژانس؛ وضعیت را می‌توانید خودتان هم تغییر دهید." />
      <LeadsInbox basePath="/agency/leads" status={ok} data={result.ok ? result.data : null} showAgent />
    </>
  );
}