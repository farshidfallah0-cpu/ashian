import Link from 'next/link';
import {
  AccountCard,
  PanelEmpty,
  PanelHeading,
} from '../../../components/account/account-card';
import { ClearLocalIds, LocalIdsRedirect } from '../../../components/account/local-ids';
import { accountGet, type ApiListingCard } from '../../../lib/account-api';

export const metadata = { title: 'بازدیدهای اخیر' };

type Props = { searchParams: Promise<{ ids?: string }> };

const empty = (
  <PanelEmpty
    title="هنوز آگهی‌ای ندیده‌اید"
    text="آگهی‌هایی که در این مرورگر باز می‌کنید اینجا می‌مانند."
  >
    <Link
      href="/search"
      className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
    >
      جستجوی آگهی‌ها
    </Link>
  </PanelEmpty>
);

export default async function RecentPage({ searchParams }: Props) {
  const { ids } = await searchParams;
  const result = ids ? await accountGet<ApiListingCard[]>(`/v1/listings/cards?ids=${encodeURIComponent(ids)}`) : null;
  const items = result?.ok ? result.data : [];

  return (
    <>
      <PanelHeading
        title="بازدیدهای اخیر"
        lead="آگهی‌هایی که اخیراً در این مرورگر دیده‌اید."
        action={
          items.length > 0 ? (
            <ClearLocalIds storageKey="ashian:recent" basePath="/account/recent" label="پاک کردن فهرست" />
          ) : undefined
        }
      />
      {!ids ? (
        <LocalIdsRedirect storageKey="ashian:recent" max={20} basePath="/account/recent" empty={empty} />
      ) : items.length === 0 ? (
        empty
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((listing) => (
            <li key={listing.publicId}>
              <AccountCard listing={listing} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}