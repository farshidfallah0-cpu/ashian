import Link from 'next/link';
import {
  AccountCard,
  PageNav,
  PanelEmpty,
  PanelHeading,
} from '../../../components/account/account-card';
import { RemoveFavorite } from '../../../components/account/remove-favorite';
import { accountGet, type ApiListingCard, type ApiPage } from '../../../lib/account-api';

export const metadata = { title: 'علاقه‌مندی‌ها' };

type Props = { searchParams: Promise<{ page?: string }> };

export default async function FavoritesPage({ searchParams }: Props) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const result = await accountGet<ApiPage<ApiListingCard>>(`/v1/favorites?page=${page}&pageSize=12`);
  const data = result.ok ? result.data : null;

  return (
    <>
      <PanelHeading
        title="علاقه‌مندی‌ها"
        lead="آگهی‌هایی که با قلب ذخیره کرده‌اید؛ تازه‌ترین اول."
      />
      {!data || data.items.length === 0 ? (
        <PanelEmpty
          title="هنوز آگهی‌ای ذخیره نکرده‌اید"
          text="روی قلب هر آگهی بزنید تا اینجا بماند و بعداً راحت پیدایش کنید."
        >
          <Link
            href="/search"
            className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
          >
            جستجوی آگهی‌ها
          </Link>
        </PanelEmpty>
      ) : (
        <>
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((listing) => (
              <li key={listing.publicId}>
                <AccountCard
                  listing={listing}
                  actions={<RemoveFavorite publicId={listing.publicId} title={listing.title} />}
                />
              </li>
            ))}
          </ul>
          <PageNav
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(p) => `/account/favorites?page=${p}`}
          />
        </>
      )}
    </>
  );
}