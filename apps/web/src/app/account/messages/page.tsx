import { LABELS, formatDate, type MyLeadDto } from '@ashian/shared';
import Link from 'next/link';
import { PageNav, PanelEmpty, PanelHeading } from '../../../components/account/account-card';
import { accountGet, type ApiPage } from '../../../lib/account-api';

export const metadata = { title: 'پیام‌ها' };

type Props = { searchParams: Promise<{ page?: string }> };

export default async function MessagesPage({ searchParams }: Props) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const result = await accountGet<ApiPage<MyLeadDto>>(`/v1/leads/mine?page=${page}&pageSize=15`);
  const data = result.ok ? result.data : null;

  return (
    <>
      <PanelHeading
        title="پیام‌ها و درخواست‌ها"
        lead="پیام‌ها و درخواست‌های بازدیدی که برای آگهی‌ها فرستاده‌اید. گفت‌وگوی مستقیم با مشاور در مرحله‌ی بعد اضافه می‌شود."
      />
      {!data || data.items.length === 0 ? (
        <PanelEmpty
          title="هنوز پیامی نفرستاده‌اید"
          text="از صفحه‌ی هر آگهی می‌توانید به مشاور پیام بدهید یا درخواست بازدید بفرستید."
        />
      ) : (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {data.items.map((lead) => (
              <li key={lead.id} className="py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-base text-ink">
                    {LABELS.leadType[lead.type]}
                    {lead.listing && (
                      <>
                        {' · '}
                        <Link
                          href={`/listings/${lead.listing.publicId}`}
                          prefetch={false}
                          className="underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
                        >
                          {lead.listing.title}
                        </Link>
                      </>
                    )}
                  </p>
                  <span className="rounded-sm bg-surface px-2 py-0.5 text-xs text-ink-2">
                    {LABELS.leadStatus[lead.status]}
                  </span>
                </div>
                {lead.message && (
                  <p className="mt-2 whitespace-pre-line text-base leading-7 text-ink-2">
                    {lead.message}
                  </p>
                )}
                <p className="mt-2 text-sm text-muted">
                  {lead.agentName ? `به ${lead.agentName} · ` : ''}
                  <time dateTime={lead.createdAt}>{formatDate(lead.createdAt, 'long')}</time>
                </p>
              </li>
            ))}
          </ul>
          <PageNav
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(p) => `/account/messages?page=${p}`}
          />
        </>
      )}
    </>
  );
}