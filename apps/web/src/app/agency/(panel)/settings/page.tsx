import { PanelHeading } from '../../../../components/account/account-card';
import { AgencyForm } from '../../../../components/panel/agency-form';
import { accountGet } from '../../../../lib/account-api';
import type { AgencyOverview } from '@ashian/shared';

export const metadata = { title: 'مشخصات آژانس' };

export default async function AgencySettingsPage() {
  const result = await accountGet<AgencyOverview>('/v1/agency/overview?days=7');
  if (!result.ok) return null;
  const a = result.data.agency;
  return (
    <>
      <PanelHeading title="مشخصات آژانس" lead="تغییر شماره‌ی مجوز (ORN) دوباره باید تأیید شود." />
      <AgencyForm
        mode="edit"
        initial={{ name: a.name, nameEn: a.nameEn ?? '', description: a.description ?? '', licenseNumber: a.licenseNumber ?? '' }}
      />
    </>
  );
}