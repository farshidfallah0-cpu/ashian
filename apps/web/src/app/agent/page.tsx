import { LABELS, formatNumber, type AgentDashboard } from '@ashian/shared';
import { Medal } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { PanelHeading } from '../../components/account/account-card';
import { DailyChart, HBars, Kpi } from '../../components/panel/charts';
import { accountGet } from '../../lib/account-api';
import { getPanelMe } from '../../lib/panel';

export const metadata = { title: 'داشبورد' };

type Props = { searchParams: Promise<{ days?: string }> };

const RANGES = [7, 30, 90] as const;

export default async function AgentDashboardPage({ searchParams }: Props) {
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const [dash, me] = await Promise.all([
    accountGet<AgentDashboard>(`/v1/agent/dashboard?days=${days}`),
    getPanelMe(),
  ]);
  if (!dash.ok) return <p className="py-20 text-base text-ink-2">آمار موقتاً در دسترس نیست.</p>;
  const d = dash.data;
  const pending = me.ok && me.data.agent?.verificationStatus !== 'verified';

  return (
    <>
      <PanelHeading
        title="داشبورد"
        lead="بازدید، سرنخ و نرخ تبدیل آگهی‌هایتان."
        action={
          <nav aria-label="بازه‌ی زمانی" className="flex gap-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/agent?days=${r}`}
                prefetch={false}
                aria-current={r === days ? 'page' : undefined}
                className={`rounded-sm px-3 py-1.5 transition-colors ${r === days ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
              >
                {formatNumber(r, 0)} روز
              </Link>
            ))}
          </nav>
        }
      />

      {pending && (
        <p role="status" className="mb-8 rounded-sm bg-accent-soft px-4 py-3 text-base text-accent-active">
          شماره‌ی مجوز (BRN) شما در انتظار تأیید تیم آشیان است. تا آن موقع پروفایل شما در فهرست مشاوران نمایش داده نمی‌شود.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-line lg:grid-cols-4">
        <Kpi label="آگهی فعال" value={formatNumber(d.kpis.activeListings, 0)} />
        <Kpi label="بازدید" value={formatNumber(d.kpis.views, 0)} sub={`${formatNumber(d.kpis.uniqueViews, 0)} بازدیدکننده‌ی یکتا`} />
        <Kpi label="سرنخ" value={formatNumber(d.kpis.leads, 0)} sub={d.kpis.newLeads ? `${formatNumber(d.kpis.newLeads, 0)} مورد بی‌پاسخ` : 'همه پاسخ داده شده'} />
        <Kpi
          label="نرخ تبدیل"
          value={d.kpis.leadRate === null ? '—' : `${formatNumber(d.kpis.leadRate, 1)}٪`}
          sub={d.kpis.avgResponseMinutes === null ? 'زمان پاسخ: هنوز آماری نیست' : `میانگین پاسخ: ${formatNumber(d.kpis.avgResponseMinutes, 0)} دقیقه`}
        />
      </dl>

      <section className="mt-12" aria-labelledby="chart">
        <h2 id="chart" className="mb-5 font-display text-xl text-ink">
          روند {formatNumber(days, 0)} روز اخیر
        </h2>
        <DailyChart series={d.series} />
      </section>

      <div className="mt-14 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="types">
          <h2 id="types" className="mb-5 font-display text-xl text-ink">
            سرنخ‌ها به تفکیک نوع
          </h2>
          <HBars
            items={(['call', 'whatsapp', 'message', 'visit_request'] as const).map((t) => ({
              label: LABELS.leadType[t],
              value: d.leadsByType[t],
            }))}
          />
          {d.kpis.newLeads > 0 && (
            <Link href="/agent/leads?status=new" className="mt-5 inline-block text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
              پاسخ به {formatNumber(d.kpis.newLeads, 0)} سرنخ جدید
            </Link>
          )}
        </section>

        <section aria-labelledby="top">
          <h2 id="top" className="mb-5 font-display text-xl text-ink">
            آگهی‌های پربازده
          </h2>
          {d.topListings.length === 0 ? (
            <p className="text-base text-muted">هنوز آگهی فعالی ندارید.</p>
          ) : (
            <ol className="divide-y divide-line border-y border-line">
              {d.topListings.map((l) => (
                <li key={l.publicId} className="flex items-baseline justify-between gap-4 py-3">
                  <Link href={`/listings/${l.publicId}`} prefetch={false} className="min-w-0 truncate text-base text-ink hover:underline">
                    {l.title}
                  </Link>
                  <span className="shrink-0 text-sm text-muted">
                    {formatNumber(l.views, 0)} بازدید · {formatNumber(l.leads, 0)} سرنخ
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="mt-14 rounded-sm border border-line p-6" aria-labelledby="badge">
        <h2 id="badge" className="flex items-center gap-2 font-display text-xl text-ink">
          <Medal size={22} weight="light" className="text-brand" aria-hidden />
          نشان «مشاور برتر»
        </h2>
        {d.badge.isTop ? (
          <p className="mt-3 text-base text-verified">همین حالا این نشان را دارید؛ هر ساعت دوباره بررسی می‌شود.</p>
        ) : (
          <>
            <p className="mt-3 text-base text-ink-2">
              این نشان فقط بر پایه‌ی امتیاز، سرعت پاسخ، کیفیت آگهی‌ها و نبود تخلف داده می‌شود. برای گرفتنش:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 ps-5 text-base text-ink-2">
              {d.badge.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}