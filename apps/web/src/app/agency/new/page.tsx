import type { Metadata } from 'next';
import { AgencyForm } from '../../../components/panel/agency-form';

export const metadata: Metadata = { title: 'ساخت آژانس', robots: { index: false, follow: false } };

export default function NewAgencyPage() {
  return (
    <main id="main" className="container-page py-10 md:py-14">
      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-3xl text-ink md:text-4xl">ساخت آژانس</h1>
        <p className="mt-3 text-base text-ink-2">تیم مشاوران را اضافه کنید و آمار تجمیعی همه‌ی آگهی‌ها و سرنخ‌ها را یک‌جا ببینید.</p>
      </header>
      <AgencyForm mode="create" initial={{ name: '', nameEn: '', description: '', licenseNumber: '' }} />
    </main>
  );
}