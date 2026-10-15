import { formatNumber, LABELS, type AgencyOverview } from '@ashian/shared';
import { SealCheck } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { PanelHeading } from '../../../components/account/account-card';
import { DailyChart, HBars, Kpi } from '../../../components/panel/charts';
import { AddMember, RemoveMember } from '../../../components/panel/team-manager';
import { accountGet } from '../../../lib/account-api';

export const metadata = { title: 'آمار و تیم' };

type Props = { searchParams: Promise<{ days?: string }> };
const RANGES = [7, 30, 90] as const;

export default async function AgencyPage({ searchParams }: Props) {
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const result = await accountGet<AgencyOverview>(`/v1/agency/overview?days=${days}`);
  if (!result.ok) return <p className="py-20 text-base text-ink-2">آمار موقتاً در دسترس نیست.</p>;
  const { agency, dashboard: d, team } = result.data;

  return (
    <>
      <PanelHeading
        title={agency.name}
        lead="آمار تجمیعی همه‌ی آگهی‌ها و سرنخ‌های تیم."
        action={
          <nav aria-label="بازه‌ی زمانی" className="flex gap-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/agency?days=${r}`}
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

      {!agency.isVerified && (
        <p role="status" className="mb-8 rounded-sm bg-accent-soft px-4 py-3 text-base text-accent-active">
          مجوز شرکت (ORN) آژانس در انتظار تأیید تیم آشیان است؛ تا آن موقع آژانس در فهرست عمومی نیست.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-line lg:grid-cols-4">
        <Kpi label="مشاور" value={formatNumber(agency.agentCount, 0)} />
        <Kpi label="آگهی فعال" value={formatNumber(d.kpis.activeListings, 0)} />
        <Kpi label="بازدید" value={formatNumber(d.kpis.views, 0)} />
        <Kpi
          label="سرنخ"
          value={formatNumber(d.kpis.leads, 0)}
          sub={d.kpis.leadRate === null ? undefined : `نرخ تبدیل ${formatNumber(d.kpis.leadRate, 1)}٪`}
        />
      </dl>

      <section className="mt-12" aria-labelledby="chart">
        <h2 id="chart" className="mb-5 font-display text-xl text-ink">
          روند {formatNumber(days, 0)} روز اخیر
        </h2>
        <DailyChart series={d.series} />
      </section>

      <section className="mt-14" aria-labelledby="types">
        <h2 id="types" className="mb-5 font-display text-xl text-ink">
          سرنخ‌ها به تفکیک نوع
        </h2>
        <div className="max-w-xl">
          <HBars
            items={(['call', 'whatsapp', 'message', 'visit_request'] as const).map((t) => ({
              label: LABELS.leadType[t],
              value: d.leadsByType[t],
            }))}
          />
        </div>
      </section>

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="team">
        <h2 id="team" className="mb-6 font-display text-2xl text-ink">
          تیم
        </h2>
        {team.length === 0 ? (
          <p className="text-base text-muted">هنوز مشاوری در تیم نیست؛ با شماره‌ی موبایل اضافه کنید.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-start text-base">
              <thead className="text-sm text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-3 text-start font-normal">مشاور</th>
                  <th scope="col" className="py-3 text-start font-normal">آگهی فعال</th>
                  <th scope="col" className="py-3 text-start font-normal">بازدید</th>
                  <th scope="col" className="py-3 text-start font-normal">سرنخ</th>
                  <th scope="col" className="py-3 text-start font-normal">زمان پاسخ</th>
                  <th scope="col" className="py-3"><span className="sr-only">کنش</span></th>
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.agentId} className="border-b border-line">
                    <th scope="row" className="py-3.5 text-start font-normal text-ink">
                      <Link href={`/agents/${m.agentId}`} prefetch={false} className="hover:underline">
                        {m.name}
                      </Link>
                      {m.isVerified && <SealCheck size={16} weight="fill" className="ms-1.5 inline text-verified" aria-label="تأییدشده" />}
                      {m.isTopAgent && <span className="ms-2 rounded-sm bg-brand-soft px-1.5 py-0.5 text-xs text-brand">برتر</span>}
                    </th>
                    <td className="py-3.5 text-ink-2">{formatNumber(m.activeListings, 0)}</td>
                    <td className="py-3.5 text-ink-2">{formatNumber(m.views, 0)}</td>
                    <td className="py-3.5 text-ink">{formatNumber(m.leads, 0)}</td>
                    <td className="py-3.5 text-ink-2">
                      {m.avgResponseMinutes === null ? '—' : `${formatNumber(m.avgResponseMinutes, 0)} دقیقه`}
                    </td>
                    <td className="py-3.5 text-end">
                      <RemoveMember agentId={m.agentId} name={m.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-8">
          <AddMember />
        </div>
      </section>
    </>
  );
}