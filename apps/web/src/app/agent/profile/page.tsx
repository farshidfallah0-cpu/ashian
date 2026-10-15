import { PanelHeading } from '../../../components/account/account-card';
import { AgentForm } from '../../../components/panel/agent-form';
import { getPanelMe } from '../../../lib/panel';
import { getPlaces } from '../../../lib/search-server';

export const metadata = { title: 'پروفایل مشاور' };

export default async function AgentProfilePage() {
  const [me, places] = await Promise.all([getPanelMe(), getPlaces()]);
  if (!me.ok || !me.data.agent) return null;
  const a = me.data.agent;
  const communities = places
    .filter((p) => p.type === 'community')
    .sort((x, y) => y.listingCount - x.listingCount)
    .map((p) => ({ id: p.id, label: p.nameFa }));
  return (
    <>
      <PanelHeading
        title="پروفایل مشاور"
        lead={
          a.verificationStatus === 'verified'
            ? 'مجوز شما تأیید شده است. تغییر شماره‌ی BRN دوباره باید تأیید شود.'
            : 'مجوز شما در انتظار تأیید است.'
        }
      />
      <AgentForm
        mode="edit"
        initial={{
          brn: a.brn ?? '',
          bio: a.bio ?? '',
          languages: a.languages,
          areaIds: a.areaIds,
          whatsapp: a.whatsapp ? `+${a.whatsapp.replace(/\D/g, '')}` : '',
        }}
        communities={communities}
      />
    </>
  );
}