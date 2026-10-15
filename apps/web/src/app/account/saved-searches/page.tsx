import { formatDate } from '@ashian/shared';
import type { SavedSearchDto } from '@ashian/shared';
import Link from 'next/link';
import { PanelEmpty, PanelHeading } from '../../../components/account/account-card';
import { AlertSettings } from '../../../components/account/saved-search-row';
import { accountGet, getMe } from '../../../lib/account-api';
import { buildChips, buildHeading, getPlaces, parseSearch } from '../../../lib/search-server';

export const metadata = { title: 'جستجوهای ذخیره‌شده' };

export default async function SavedSearchesPage() {
  const [result, me, places] = await Promise.all([
    accountGet<SavedSearchDto[]>('/v1/saved-searches'),
    getMe(),
    getPlaces(),
  ]);
  const searches = result.ok ? result.data : [];
  const hasEmail = me.ok && !!me.data.user.email;

  return (
    <>
      <PanelHeading
        title="جستجوهای ذخیره‌شده"
        lead="با هر آگهی تازه‌ای که با فیلترهایتان بخواند، فوری یا خلاصه‌ی روزانه و هفتگی خبر می‌گیرید."
      />
      {searches.length === 0 ? (
        <PanelEmpty
          title="جستجوی ذخیره‌شده‌ای ندارید"
          text="در صفحه‌ی نتایج فیلترهایتان را بزنید و «ذخیره‌ی جستجو» را انتخاب کنید."
        >
          <Link
            href="/search"
            className="text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
          >
            رفتن به جستجو
          </Link>
        </PanelEmpty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {searches.map((search) => {
            const parsed = parseSearch(Object.fromEntries(new URLSearchParams(search.query)));
            const heading = buildHeading(parsed.query, places);
            const chips = buildChips(parsed.query, parsed.qs, places).slice(0, 6);
            return (
              <li key={search.id} className="py-7">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="font-display text-lg text-ink">{search.name}</h2>
                  <Link
                    href={`/search?${search.query}${search.query ? '&' : ''}sort=newest`}
                    prefetch={false}
                    className="text-sm text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
                  >
                    مشاهده‌ی نتایج
                  </Link>
                </div>
                <p className="mt-1 text-sm text-muted">{heading}</p>
                {chips.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {chips.map((chip) => (
                      <li
                        key={chip.id}
                        className="rounded-sm bg-surface px-2.5 py-1 text-sm text-ink-2"
                      >
                        {chip.label}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-muted">
                  ذخیره در {formatDate(search.createdAt, 'long')}
                  {search.lastNotifiedAt && <> · آخرین هشدار {formatDate(search.lastNotifiedAt, 'long')}</>}
                </p>
                <AlertSettings search={search} hasEmail={hasEmail} />
              </li>
            );
          })}
        </ul>
      )}
      {searches.some((s) => s.channels.includes('email')) && !hasEmail && (
        <p className="mt-6 text-sm text-danger">
          برای دریافت ایمیل باید ایمیل خود را در{' '}
          <Link href="/account/settings" className="underline">
            تنظیمات حساب
          </Link>{' '}
          ثبت کنید.
        </p>
      )}
    </>
  );
}