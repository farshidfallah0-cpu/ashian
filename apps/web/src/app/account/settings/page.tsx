import { PanelHeading } from '../../../components/account/account-card';
import { LogoutButton, ProfileForm } from '../../../components/account/profile-form';
import { getMe } from '../../../lib/account-api';

export const metadata = { title: 'تنظیمات حساب' };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me.ok) return null;
  return (
    <>
      <PanelHeading title="تنظیمات حساب" lead="نام و ایمیل شما برای مشاوران و هشدارها استفاده می‌شود." />
      <ProfileForm user={me.data.user} />
      <section className="mt-14 border-t border-line pt-8">
        <h2 className="font-display text-lg text-ink">نشست</h2>
        <p className="mt-1.5 max-w-md text-base text-muted">
          با خروج، نشست این مرورگر بسته و توکن نوسازی باطل می‌شود.
        </p>
        <div className="mt-5">
          <LogoutButton />
        </div>
      </section>
    </>
  );
}