import type { Metadata } from 'next';
import { AgentForm } from '../../../components/panel/agent-form';
import { getAgencies } from '../../../lib/agents';
import { getPlaces } from '../../../lib/search-server';

export const metadata: Metadata = {
  title: 'پیوستن مشاوران به آشیان',
  description: 'ثبت‌نام مشاور املاک با شماره‌ی مجوز (BRN): آگهی با نام و مجوز شما، سرنخ‌ها و آمار در یک پنل.',
};

export default async function JoinAgentPage() {
  const [places, agencies] = await Promise.all([getPlaces(), getAgencies('pageSize=50')]);
  const communities = places
    .filter((p) => p.type === 'community')
    .sort((a, b) => b.listingCount - a.listingCount)
    .map((p) => ({ id: p.id, label: p.nameFa }));
  return (
    <main id="main" className="container-page py-10 md:py-14">
      <header className="mb-10 max-w-2xl">
        <p className="font-sans text-sm text-muted">مشاوران</p>
        <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">پیوستن به آشیان</h1>
        <p className="mt-3 text-base text-ink-2">
          آگهی‌های شما با نام و شماره‌ی مجوزتان دیده می‌شوند و در جستجو منصفانه نمایش داده می‌شوند: هیچ مشاوری صفحه را قبضه نمی‌کند.
        </p>
      </header>
      <AgentForm
        mode="join"
        initial={{ brn: '', bio: '', languages: ['fa'], areaIds: [], whatsapp: '' }}
        communities={communities}
        agencies={(agencies?.items ?? []).map((a) => ({ slug: a.slug, label: a.name }))}
      />
    </main>
  );
}