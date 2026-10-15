import { formatNumber } from '@ashian/shared';
import { SealCheck } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentCard, Avatar } from '../../../components/agents/agent-card';
import { getAgency } from '../../../lib/agents';
import { SITE_URL } from '../../../lib/listing-seo';

export const revalidate = 120;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getAgency(slug).catch(() => null);
  if (!result?.ok) return { title: 'آژانس پیدا نشد', robots: { index: false } };
  const a = result.data;
  return {
    title: `${a.name}، آژانس املاک`,
    description: `${a.name}؛ ${formatNumber(a.agentCount, 0)} مشاور و ${formatNumber(a.activeListingCount, 0)} آگهی فعال در دبی. ${a.description ?? ''}`.trim(),
    alternates: { canonical: `/agencies/${slug}` },
  };
}

export default async function AgencyPage({ params }: Props) {
  const { slug } = await params;
  const result = await getAgency(slug);
  if (!result.ok) notFound();
  const agency = result.data;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${SITE_URL}/agencies/${slug}`,
    name: agency.name,
    ...(agency.nameEn ? { alternateName: agency.nameEn } : {}),
    url: `${SITE_URL}/agencies/${slug}`,
    ...(agency.description ? { description: agency.description } : {}),
    employee: agency.team.map((m) => ({ '@type': 'Person', name: m.name })),
  }).replace(/</g, '\\u003c');

  return (
    <main id="main" className="container-page py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <nav aria-label="مسیر صفحه" className="text-sm text-muted">
        <Link href="/agencies" className="hover:text-ink hover:underline">
          آژانس‌ها
        </Link>
        <span className="mx-1.5 text-faint">›</span>
        <span className="text-ink-2">{agency.name}</span>
      </nav>

      <header className="mt-6 grid gap-8 md:grid-cols-[auto_1fr] md:gap-12">
        <Avatar name={agency.name} size="xl" />
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl text-ink md:text-4xl">
            {agency.name}
            {agency.isVerified && <SealCheck size={28} weight="fill" className="text-verified" aria-label="آژانس تأییدشده" />}
          </h1>
          {agency.nameEn && (
            <p dir="ltr" className="mt-1 text-start font-sans text-base text-muted">
              {agency.nameEn}
            </p>
          )}
          {agency.description && <p className="mt-4 max-w-2xl text-base leading-8 text-ink-2">{agency.description}</p>}
          {agency.licenseNumber && (
            <p className="mt-3 text-sm text-muted">
              شماره‌ی مجوز شرکت (ORN):{' '}
              <span dir="ltr" className="font-sans text-ink-2">
                {agency.licenseNumber}
              </span>
            </p>
          )}
        </div>
      </header>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-line sm:max-w-lg">
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">مشاور</dt>
          <dd className="mt-1 font-display text-2xl text-ink">{formatNumber(agency.agentCount, 0)}</dd>
        </div>
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">آگهی فعال</dt>
          <dd className="mt-1 font-display text-2xl text-ink">{formatNumber(agency.activeListingCount, 0)}</dd>
        </div>
      </dl>

      {agency.areas.length > 0 && (
        <section className="mt-12" aria-labelledby="areas">
          <h2 id="areas" className="font-display text-xl text-ink">
            محله‌های فعالیت تیم
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {agency.areas.map((a) => (
              <li key={a.slug} className="rounded-sm border border-line-strong px-3 py-1.5 text-base text-ink-2">
                {a.nameFa}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="team">
        <h2 id="team" className="font-display text-2xl text-ink">
          تیم مشاوران
        </h2>
        {agency.team.length === 0 ? (
          <p className="mt-4 text-base text-muted">هنوز مشاور تأییدشده‌ای در تیم نیست.</p>
        ) : (
          <ul className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {agency.team.map((m) => (
              <li key={m.id}>
                <AgentCard agent={m} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}