import { formatNumber } from '@ashian/shared';
import { SealCheck } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageNav } from '../../components/account/account-card';
import { Avatar } from '../../components/agents/agent-card';
import { getAgencies } from '../../lib/agents';

export const metadata: Metadata = {
  title: 'آژانس‌های املاک دبی',
  description: 'آژانس‌های املاک تأییدشده‌ی دبی با تیم مشاوران و آگهی‌های فعال.',
  alternates: { canonical: '/agencies' },
};

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function AgenciesPage({ searchParams }: Props) {
  const { q = '', page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (q.trim()) qs.set('q', q.trim().slice(0, 60));
  const result = await getAgencies(qs.toString());

  return (
    <main id="main" className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="font-sans text-sm text-muted">آژانس‌ها</p>
        <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">آژانس‌های املاک دبی</h1>
        <p className="mt-3 text-base text-ink-2">شماره‌ی مجوز شرکت (ORN) همه‌ی آژانس‌های این فهرست بررسی شده است.</p>
      </header>
      <form method="get" action="/agencies" className="mt-8 flex max-w-md gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="نام آژانس"
          aria-label="نام آژانس"
          className="h-11 w-full rounded-sm border border-line-strong bg-bg px-3.5 text-base text-ink placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
        />
        <button type="submit" className="h-11 shrink-0 rounded-sm bg-brand px-5 text-base font-medium text-white hover:bg-brand-hover">
          جستجو
        </button>
      </form>

      {!result || result.items.length === 0 ? (
        <p className="py-20 text-base text-ink-2">آژانسی پیدا نشد.</p>
      ) : (
        <>
          <ul className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((a) => (
              <li key={a.id} className="border-t border-line pt-6">
                <div className="flex items-start gap-4">
                  <Avatar name={a.name} />
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-1.5 font-display text-lg leading-snug text-ink">
                      <Link href={`/agencies/${a.slug}`} prefetch={false} className="hover:underline">
                        {a.name}
                      </Link>
                      {a.isVerified && <SealCheck size={18} weight="fill" className="shrink-0 text-verified" aria-label="تأییدشده" />}
                    </h2>
                    {a.nameEn && (
                      <p dir="ltr" className="text-start font-sans text-sm text-muted">
                        {a.nameEn}
                      </p>
                    )}
                  </div>
                </div>
                {a.description && <p className="mt-3 line-clamp-2 text-base text-ink-2">{a.description}</p>}
                <dl className="mt-4 flex gap-8 text-sm">
                  <div>
                    <dt className="text-muted">مشاور</dt>
                    <dd className="text-base text-ink">{formatNumber(a.agentCount, 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">آگهی فعال</dt>
                    <dd className="text-base text-ink">{formatNumber(a.activeListingCount, 0)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <PageNav
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(p) => `/agencies?${q ? `q=${encodeURIComponent(q)}&` : ''}page=${p}`}
          />
        </>
      )}
    </main>
  );
}