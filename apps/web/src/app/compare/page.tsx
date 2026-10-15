import type { CompareItem } from '@ashian/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PanelEmpty } from '../../components/account/account-card';
import { LocalIdsRedirect } from '../../components/account/local-ids';
import { CompareTable } from '../../components/compare/compare-table';
import { apiGet } from '../../lib/api';

export const metadata: Metadata = {
  title: 'مقایسه‌ی ملک‌ها',
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<{ ids?: string }> };

const empty = (
  <PanelEmpty
    title="هنوز ملکی برای مقایسه انتخاب نکرده‌اید"
    text="در صفحه‌ی هر آگهی روی «مقایسه» بزنید؛ تا چهار ملک را می‌توانید کنار هم ببینید."
  >
    <Link
      href="/search"
      className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
    >
      جستجوی آگهی‌ها
    </Link>
  </PanelEmpty>
);

/** مقایسه‌ی تا ۴ ملک، کنار هم؛ برای مهمان هم کار می‌کند و لینکش قابل اشتراک است (?ids=a,b) */
export default async function ComparePage({ searchParams }: Props) {
  const { ids } = await searchParams;
  const items = ids
    ? ((await apiGet<CompareItem[]>(`/v1/listings/compare?ids=${encodeURIComponent(ids)}`, {
        revalidate: 0,
      })) ?? [])
    : [];

  return (
    <main id="main" className="container-page py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-display text-2xl text-ink md:text-3xl">مقایسه‌ی ملک‌ها</h1>
          <p className="mt-1.5 text-base text-muted">
            تفاوت‌ها با نقطه‌ی نارنجی مشخص شده‌اند و بهترین قیمت و متراژ سبز است.
          </p>
        </div>
        {items.length > 0 && items.length < 4 && (
          <Link
            href="/search"
            className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
          >
            افزودن ملک دیگر
          </Link>
        )}
      </div>

      {!ids ? (
        <LocalIdsRedirect storageKey="ashian:compare" max={4} basePath="/compare" empty={empty} />
      ) : items.length === 0 ? (
        empty
      ) : (
        <>
          {items.length < 2 && (
            <p className="mb-6 text-base text-ink-2">برای مقایسه حداقل دو ملک لازم است.</p>
          )}
          <CompareTable items={items} />
        </>
      )}
    </main>
  );
}