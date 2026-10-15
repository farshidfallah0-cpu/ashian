import { LABELS, formatNumber, type ListingStatus } from '@ashian/shared';
import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';
import {
  AccountCard,
  PageNav,
  PanelEmpty,
  PanelHeading,
} from '../../../components/account/account-card';
import { accountGet, type ApiListingCard, type ApiPage } from '../../../lib/account-api';

export const metadata = { title: 'آگهی‌های من' };

type Props = { searchParams: Promise<{ page?: string; status?: string }> };

const STATUSES: Array<ListingStatus | 'all'> = [
  'all',
  'active',
  'pending_review',
  'draft',
  'rejected',
  'expired',
];

const isStatus = (v: string | undefined): v is ListingStatus =>
  !!v && (STATUSES as string[]).includes(v) && v !== 'all';

export default async function MyListingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = isStatus(params.status) ? params.status : undefined;
  const qs = `page=${page}&pageSize=12${status ? `&status=${status}` : ''}`;
  const result = await accountGet<ApiPage<ApiListingCard>>(`/v1/listings/mine?${qs}`);
  const data = result.ok ? result.data : null;

  return (
    <>
      <PanelHeading
        title="آگهی‌های من"
        lead="وضعیت آگهی‌هایتان از پیش‌نویس تا فعال."
        action={
          <Link
            href="/listings/new"
            prefetch={false}
            className={buttonClasses({ variant: 'primary', size: 'md' })}
          >
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
              href={s === 'all' ? '/account/listings' : `/account/listings?status=${s}`}
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
        <PanelEmpty
          title="آگهی‌ای در این وضعیت نیست"
          text="آگهی‌هایی که ثبت کنید با وضعیتشان اینجا دیده می‌شوند."
        />
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">{formatNumber(data.total, 0)} آگهی</p>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((listing) => (
              <li key={listing.publicId}>
                <AccountCard
                  listing={listing}
                  showStatus
                  actions={
                    <Link
                      href={`/listings/${listing.publicId}/edit`}
                      prefetch={false}
                      className="text-sm text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
                    >
                      {listing.status === 'draft' ? 'ادامه‌ی ثبت' : 'ویرایش'}
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
          <PageNav
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(p) => `/account/listings?${status ? `status=${status}&` : ''}page=${p}`}
          />
        </>
      )}
    </>
  );
}