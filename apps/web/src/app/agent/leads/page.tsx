import type { InboxLead } from '@ashian/shared';
import { PanelHeading } from '../../../components/account/account-card';
import { LeadsInbox } from '../../../components/panel/leads-inbox';
import { accountGet, type ApiPage } from '../../../lib/account-api';

export const metadata = { title: 'سرنخ‌ها' };

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

export default async function AgentLeadsPage({ searchParams }: Props) {
  const { status = '', page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const ok = ['new', 'contacted', 'viewing', 'closed'].includes(status) ? status : '';
  const result = await accountGet<ApiPage<InboxLead>>(`/v1/agent/leads?page=${page}&pageSize=15${ok ? `&status=${ok}` : ''}`);
  return (
    <>
      <PanelHeading title="سرنخ‌ها" lead="سریع‌تر پاسخ بدهید؛ میانگین زمان پاسخ شما در نشان «مشاور برتر» اثر دارد." />
      <LeadsInbox basePath="/agent/leads" status={ok} data={result.ok ? result.data : null} />
    </>
  );
}