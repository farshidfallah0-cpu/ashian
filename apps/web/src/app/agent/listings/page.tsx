import { LABELS, formatDate, formatNumber, type ListingStatus } from '@ashian/shared';
import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';
import { AccountCard, PageNav, PanelEmpty, PanelHeading } from '../../../components/account/account-card';
import { ManageActions } from '../../../components/panel/manage-actions';
import { accountGet, type ApiListingCard, type ApiPage } from '../../../lib/account-api';

export const metadata = { title: 'آگهی‌های من' };

/** تاریخ گذشته است؟ (تابع جدا تا رندر خالص بماند) */
function isPast(iso: string | null): boolean {
  return iso ? new Date(iso).getTime() < Date.now() : false;
}

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

const STATUSES: Array<ListingStatus | 'all'> = ['all', 'active', 'paused', 'pending_review', 'draft', 'rejected', 'expired'];

export default async function AgentListingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = (STATUSES as string[]).includes(params.status ?? '') && params.status !== 'all' ? (params.status as ListingStatus) : undefined;
  const result = await accountGet<ApiPage<ApiListingCard>>(
    `/v1/listings/mine?page=${page}&pageSize=12${status ? `&status=${status}` : ''}`,
  );
  const data = result.ok ? result.data : null;

  return (
    <>
      <PanelHeading
        title="آگهی‌های من"
        lead="تمدید، توقف، ویرایش و ارتقای آگهی‌ها."
        action={
          <Link href="/listings/new" className={buttonClasses({ variant: 'primary', size: 'md' })}>
            ثبت آگهی جدید
          </Link>
        }
      />
      <nav aria-label="فیلتر وضعیت" className="scrollbar-none -mx-4 mb-8 flex gap-5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {STATUSES.map((s) => {
          const active = (s === 'all' && !status) || s === status;
          return (
            <Link
              key={s}
              href={s === 'all' ? '/agent/listings' : `/agent/listings?status=${s}`}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 pb-2 text-base transition-colors ${
                active ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {s === 'all' ? 'همه' : LABELS.listingStatus[s]}
            </Link>
          );
        })}
      </nav>

      {!data || data.items.length === 0 ? (
        <PanelEmpty title="آگهی‌ای در این وضعیت نیست" text="آگهی‌های جدید را با «ثبت آگهی جدید» اضافه کنید." />
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">{formatNumber(data.total, 0)} آگهی</p>
          <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((l) => {
              const expired = isPast(l.expiresAt);
              return (
                <li key={l.publicId}>
                  <AccountCard listing={l} showStatus />
                  {l.expiresAt && (l.status === 'active' || l.status === 'paused') && (
                    <p className={`mt-2 text-sm ${expired ? 'text-danger' : 'text-muted'}`}>
                      {expired ? 'مهلت تمام شده؛ تمدید کنید' : `تا ${formatDate(l.expiresAt, 'long')}`}
                    </p>
                  )}
                  <ManageActions publicId={l.publicId} status={l.status} />
                </li>
              );
            })}
          </ul>
          <PageNav page={data.page} totalPages={data.totalPages} hrefFor={(p) => `/agent/listings?${status ? `status=${status}&` : ''}page=${p}`} />
        </>
      )}
    </>
  );
}