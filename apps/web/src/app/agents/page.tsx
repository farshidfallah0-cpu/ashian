import { AGENT_LANGUAGES, LABELS, LANGUAGE_LABELS, formatNumber } from '@ashian/shared';
import { buttonClasses, controlClass } from '@ashian/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageNav } from '../../components/account/account-card';
import { AgentCard } from '../../components/agents/agent-card';
import { getAgents } from '../../lib/agents';
import { getPlaces } from '../../lib/search-server';

export const metadata: Metadata = {
  title: 'مشاوران املاک دبی',
  description:
    'مشاوران املاک تأییدشده‌ی دبی با شماره‌ی مجوز (BRN)، امتیاز، زمان پاسخ و آگهی‌های فعال؛ بر اساس محله، تخصص و زبان جستجو کنید.',
  alternates: { canonical: '/agents' },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FIELDS = ['q', 'communityId', 'dealType', 'propertyType', 'language', 'sort'] as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

const SORTS = [
  ['top', 'مشاوران برتر اول'],
  ['listings', 'بیشترین آگهی'],
  ['rating', 'بالاترین امتیاز'],
] as const;

export default async function AgentsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const values = Object.fromEntries(FIELDS.map((k) => [k, first(raw[k]).slice(0, 60)])) as Record<
    (typeof FIELDS)[number],
    string
  >;
  const page = Math.max(1, Number(first(raw.page)) || 1);

  const params = new URLSearchParams();
  for (const k of FIELDS) if (values[k]) params.set(k, values[k]);
  const filtersQs = params.toString();
  params.set('page', String(page));
  params.set('pageSize', '12');

  const [result, places] = await Promise.all([getAgents(params.toString()), getPlaces()]);
  const communities = places.filter((p) => p.type === 'community').sort((a, b) => b.listingCount - a.listingCount);
  const active = FIELDS.some((k) => k !== 'sort' && values[k]);
  const select = `${controlClass} h-11`;

  return (
    <main id="main" className="container-page py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="font-sans text-sm text-muted">مشاوران</p>
        <h1 className="mt-2 font-display text-3xl text-ink md:text-4xl">مشاوران املاک دبی</h1>
        <p className="mt-3 text-base text-ink-2">
          فقط مشاورانی که مجوز (BRN) آن‌ها بررسی شده است. «مشاور برتر» را بر اساس امتیاز، سرعت پاسخ، کیفیت آگهی‌ها
          و نبود تخلف می‌دهیم، نه با پرداخت.
        </p>
      </header>

      <form method="get" action="/agents" className="mt-10 grid gap-4 border-y border-line py-6 md:grid-cols-6">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-muted">نام مشاور</span>
          <input name="q" defaultValue={values.q} className={select} placeholder="مثلاً سحر" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">محله</span>
          <select name="communityId" defaultValue={values.communityId} className={select}>
            <option value="">همه</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameFa}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">تخصص</span>
          <select name="dealType" defaultValue={values.dealType} className={select}>
            <option value="">همه</option>
            {(['rent', 'sale', 'full_mortgage', 'short_term'] as const).map((d) => (
              <option key={d} value={d}>
                {LABELS.dealType[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">نوع ملک</span>
          <select name="propertyType" defaultValue={values.propertyType} className={select}>
            <option value="">همه</option>
            {(Object.keys(LABELS.propertyType) as Array<keyof typeof LABELS.propertyType>).map((t) => (
              <option key={t} value={t}>
                {LABELS.propertyType[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">زبان</span>
          <select name="language" defaultValue={values.language} className={select}>
            <option value="">همه</option>
            {AGENT_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm text-muted">مرتب‌سازی</span>
          <select name="sort" defaultValue={values.sort || 'top'} className={select}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-4 md:col-span-4">
          <button type="submit" className={buttonClasses({ variant: 'dark', size: 'md' })}>
            جستجو
          </button>
          {active && (
            <Link href="/agents" className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
              پاک کردن فیلترها
            </Link>
          )}
        </div>
      </form>

      {!result ? (
        <p className="py-20 text-center text-base text-ink-2">فهرست مشاوران موقتاً در دسترس نیست.</p>
      ) : result.items.length === 0 ? (
        <p className="py-20 text-base text-ink-2">مشاوری با این فیلترها پیدا نشد. فیلترها را کم کنید.</p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted">{formatNumber(result.total, 0)} مشاور</p>
          <ul className="mt-4 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((agent) => (
              <li key={agent.id}>
                <AgentCard agent={agent} />
              </li>
            ))}
          </ul>
          <PageNav
            page={result.page}
            totalPages={result.totalPages}
            hrefFor={(p) => `/agents?${filtersQs}${filtersQs ? '&' : ''}page=${p}`}
          />
        </>
      )}

      <section className="mt-16 grid gap-6 border-t border-line pt-10 md:grid-cols-2">
        <div>
          <h2 className="font-display text-xl text-ink">مشاور هستید؟</h2>
          <p className="mt-2 text-base text-muted">
            با شماره‌ی مجوز (BRN) ثبت‌نام کنید؛ بعد از تأیید، آگهی‌هایتان با نام و مجوز شما دیده می‌شود.
          </p>
          <Link href="/agents/join" className={`${buttonClasses({ variant: 'primary', size: 'md' })} mt-4`}>
            پیوستن به آشیان
          </Link>
        </div>
        <div>
          <h2 className="font-display text-xl text-ink">آژانس دارید؟</h2>
          <p className="mt-2 text-base text-muted">تیم را یک‌جا مدیریت کنید و آمار تجمیعی بگیرید.</p>
          <Link href="/agency/new" className={`${buttonClasses({ variant: 'secondary', size: 'md' })} mt-4`}>
            ساخت آژانس
          </Link>
        </div>
      </section>
    </main>
  );
}