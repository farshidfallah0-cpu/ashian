import { LABELS, formatNumber, formatRelative, type InboxLead } from '@ashian/shared';
import { CalendarCheck, ChatCircleDots, Phone, WhatsappLogo } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { PageNav } from '../account/account-card';
import { LeadStatus } from './lead-status';

const ICON = {
  call: <Phone size={18} aria-hidden />,
  whatsapp: <WhatsappLogo size={18} aria-hidden />,
  message: <ChatCircleDots size={18} aria-hidden />,
  visit_request: <CalendarCheck size={18} aria-hidden />,
} as const;

const TABS = [
  ['', 'همه'],
  ['new', 'جدید'],
  ['contacted', 'تماس گرفته شد'],
  ['viewing', 'بازدید'],
  ['closed', 'بسته‌شده'],
] as const;

/** صندوق سرنخ: فیلتر وضعیت در URL، هر ردیف با شماره‌ی مشتری و انتخاب وضعیت */
export function LeadsInbox({
  basePath,
  status,
  data,
  showAgent = false,
}: {
  basePath: string;
  status: string;
  data: { items: InboxLead[]; page: number; totalPages: number; total: number } | null;
  showAgent?: boolean;
}) {
  return (
    <>
      <nav aria-label="فیلتر وضعیت" className="scrollbar-none -mx-4 mb-8 flex gap-5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map(([value, text]) => {
          const active = value === status;
          return (
            <Link
              key={value || 'all'}
              href={value ? `${basePath}?status=${value}` : basePath}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 pb-2 text-base transition-colors ${
                active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {text}
            </Link>
          );
        })}
      </nav>

      {!data || data.items.length === 0 ? (
        <p className="rounded-sm border border-dashed border-line-strong px-6 py-12 text-base text-muted">
          سرنخی در این وضعیت نیست. هر تماس، واتساپ، پیام یا درخواست بازدید از آگهی‌هایتان اینجا جمع می‌شود.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">{formatNumber(data.total, 0)} سرنخ</p>
          <ul className="divide-y divide-line border-y border-line">
            {data.items.map((lead) => (
              <li key={lead.id} className="grid gap-3 py-5 md:grid-cols-[1fr_auto] md:gap-8">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-ink">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      {ICON[lead.type]}
                      {LABELS.leadType[lead.type]}
                    </span>
                    {lead.listing && (
                      <Link href={`/listings/${lead.listing.publicId}`} prefetch={false} className="min-w-0 truncate underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
                        {lead.listing.title}
                      </Link>
                    )}
                  </p>
                  {(lead.name || lead.phone) && (
                    <p className="mt-1.5 text-base text-ink">
                      {lead.name}
                      {lead.phone && (
                        <>
                          {lead.name && ' · '}
                          <a href={`tel:+${lead.phone}`} dir="ltr" className="font-sans underline decoration-line-strong underline-offset-[6px]">
                            +{lead.phone}
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {lead.message && <p className="mt-1.5 whitespace-pre-line text-base leading-7 text-ink-2">{lead.message}</p>}
                  <p className="mt-1.5 text-sm text-muted">
                    <time dateTime={lead.createdAt}>{formatRelative(lead.createdAt)}</time>
                    {showAgent && lead.agentName && ` · ${lead.agentName}`}
                    {lead.firstResponseAt && ' · پاسخ داده شده'}
                  </p>
                </div>
                <LeadStatus leadId={lead.id} status={lead.status} />
              </li>
            ))}
          </ul>
          <PageNav
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(p) => `${basePath}?${status ? `status=${status}&` : ''}page=${p}`}
          />
        </>
      )}
    </>
  );
}