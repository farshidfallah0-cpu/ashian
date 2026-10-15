import { Badge } from '@ashian/ui';
import { LABELS, formatDate, formatNumber } from '@ashian/shared';
import { Clock, Medal, SealCheck } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Rating, languageNames, responseText } from '../../../components/agents/agent-card';
import { ListingCard } from '../../../components/listing-card';
import { getAgent, getAgentListings } from '../../../lib/agents';
import { SITE_URL } from '../../../lib/listing-seo';

export const revalidate = 120;

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: 'مشاور پیدا نشد', robots: { index: false } };
  const result = await getAgent(id);
  if (!result.ok) return { title: 'مشاور پیدا نشد', robots: { index: false } };
  const a = result.data;
  const description = `${a.name}${a.agency ? `، ${a.agency.name}` : ''}؛ ${formatNumber(a.activeListingCount, 0)} آگهی فعال در دبی. ${a.bio ?? ''}`.trim();
  return {
    title: `${a.name}، مشاور املاک`,
    description,
    alternates: { canonical: `/agents/${id}` },
    openGraph: { type: 'profile', title: a.name, description, locale: 'fa_IR', siteName: 'آشیان' },
  };
}

export default async function AgentPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const result = await getAgent(id);
  if (!result.ok) notFound();
  const agent = result.data;
  const listings = await getAgentListings(id, 12);
  const response = responseText(agent.avgResponseMinutes);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${SITE_URL}/agents/${id}`,
    name: agent.name,
    url: `${SITE_URL}/agents/${id}`,
    ...(agent.bio ? { description: agent.bio } : {}),
    knowsLanguage: agent.languages,
    areaServed: agent.areas.map((a) => a.nameFa),
    ...(agent.agency ? { worksFor: { '@type': 'Organization', name: agent.agency.name } } : {}),
    ...(agent.rating !== null && agent.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: agent.rating,
            reviewCount: agent.reviewCount,
          },
        }
      : {}),
  }).replace(/</g, '\\u003c');

  return (
    <main id="main" className="container-page py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <nav aria-label="مسیر صفحه" className="text-sm text-muted">
        <Link href="/agents" className="hover:text-ink hover:underline">
          مشاوران
        </Link>
        <span className="mx-1.5 text-faint">›</span>
        <span className="text-ink-2">{agent.name}</span>
      </nav>

      <header className="mt-6 grid gap-8 md:grid-cols-[auto_1fr] md:gap-12">
        <Avatar name={agent.name} size="xl" />
        <div>
          <h1 className="flex flex-wrap items-center gap-3 font-display text-3xl text-ink md:text-4xl">
            {agent.name}
            {agent.isVerified && <SealCheck size={28} weight="fill" className="text-verified" aria-label="مشاور تأییدشده" />}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-base text-ink-2">
            {agent.agency && (
              <Link href={`/agencies/${agent.agency.slug}`} className="underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
                {agent.agency.name}
              </Link>
            )}
            {agent.isTopAgent && <Badge kind="topAgent" />}
            <span>
              <Rating rating={agent.rating} count={agent.reviewCount} />
            </span>
          </div>
        </div>
      </header>

      <dl className="mt-10 grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-4">
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">آگهی فعال</dt>
          <dd className="mt-1 font-display text-2xl text-ink">{formatNumber(agent.activeListingCount, 0)}</dd>
        </div>
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">زمان پاسخ</dt>
          <dd className="mt-1 flex items-center gap-2 text-base text-ink">
            <Clock size={18} aria-hidden />
            {response ?? 'هنوز آمار کافی نیست'}
          </dd>
        </div>
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">زبان</dt>
          <dd className="mt-1 text-base text-ink">{languageNames(agent.languages)}</dd>
        </div>
        <div className="bg-bg p-5">
          <dt className="text-sm text-muted">عضویت در آشیان</dt>
          <dd className="mt-1 text-base text-ink">{formatDate(agent.joinedAt, 'long')}</dd>
        </div>
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          {agent.bio && (
            <section aria-labelledby="bio">
              <h2 id="bio" className="font-display text-xl text-ink">
                درباره‌ی مشاور
              </h2>
              <p className="mt-3 max-w-2xl whitespace-pre-line text-base leading-8 text-ink-2">{agent.bio}</p>
            </section>
          )}
          {agent.areas.length > 0 && (
            <section className="mt-10" aria-labelledby="areas">
              <h2 id="areas" className="font-display text-xl text-ink">
                محله‌های فعالیت
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {agent.areas.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/search?location=dubai/${a.slug}&agentId=${agent.id}`}
                      prefetch={false}
                      className="inline-block rounded-sm border border-line-strong px-3 py-1.5 text-base text-ink-2 hover:border-ink hover:text-ink"
                    >
                      {a.nameFa}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside aria-labelledby="spec" className="border-t border-line pt-6 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-0">
          <h2 id="spec" className="font-display text-xl text-ink">
            تخصص
          </h2>
          {agent.deals.length === 0 ? (
            <p className="mt-3 text-base text-muted">آگهی فعالی ندارد.</p>
          ) : (
            <>
              <ul className="mt-4 space-y-2 text-base">
                {agent.deals.map((d) => (
                  <li key={d.dealType} className="flex justify-between gap-4">
                    <span className="text-ink-2">{LABELS.dealType[d.dealType]}</span>
                    <span className="text-ink">{formatNumber(d.count, 0)} آگهی</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-sm text-muted">
                {agent.propertyTypes.map((t) => (
                  <li key={t.propertyType}>
                    {LABELS.propertyType[t.propertyType]} ({formatNumber(t.count, 0)})
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-6 flex gap-2 border-t border-line pt-4 text-sm leading-7 text-muted">
            <Medal size={18} className="mt-1 shrink-0" aria-hidden />
            برای تماس، از دکمه‌های همان آگهی استفاده کنید تا درخواست شما ثبت و پیگیری شود.
          </p>
        </aside>
      </div>

      {listings && listings.items.length > 0 && (
        <section className="mt-16 border-t border-line pt-10" aria-labelledby="listings">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="listings" className="font-display text-2xl text-ink">
              آگهی‌های فعال
            </h2>
            {listings.total > listings.items.length && (
              <Link
                href={`/search?agentId=${agent.id}&sort=newest`}
                className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
              >
                همه‌ی {formatNumber(listings.total, 0)} آگهی
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-4">
            {listings.items.map((l) => (
              <li key={l.publicId}>
                <ListingCard listing={l} sizes="(min-width: 1024px) 22vw, (min-width: 560px) 45vw, 92vw" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}