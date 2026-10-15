import { formatNumber, formatRelative } from '@ashian/shared';
import Link from 'next/link';
import { PanelHeading } from '../../components/account/account-card';
import { accountGet, getMe, type ApiPage } from '../../lib/account-api';

export const metadata = { title: 'نمای کلی' };

const TILE =
  'group flex flex-col gap-1 bg-bg p-6 outline-offset-[-2px] transition-colors hover:bg-surface';

export default async function AccountOverview() {
  const [me, favorites, mine, saved, notes] = await Promise.all([
    getMe(),
    accountGet<ApiPage<unknown>>('/v1/favorites?pageSize=1'),
    accountGet<ApiPage<unknown>>('/v1/listings/mine?pageSize=1'),
    accountGet<unknown[]>('/v1/saved-searches'),
    accountGet<ApiPage<{ id: string; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string }>>(
      '/v1/notifications?pageSize=4',
    ),
  ]);
  const name = me.ok ? me.data.user.name : null;
  const count = (r: { ok: boolean; data?: unknown }) =>
    r.ok ? ((r as { data: ApiPage<unknown> }).data.total ?? 0) : 0;

  const tiles = [
    { href: '/account/favorites', label: 'علاقه‌مندی‌ها', value: count(favorites) },
    {
      href: '/account/saved-searches',
      label: 'جستجوی ذخیره‌شده',
      value: saved.ok ? saved.data.length : 0,
    },
    { href: '/account/listings', label: 'آگهی‌های من', value: count(mine) },
  ];

  return (
    <>
      <PanelHeading
        title={name ? `سلام ${name}` : 'خوش آمدید'}
        lead="علاقه‌مندی‌ها، هشدارها و آگهی‌هایتان یک‌جاست."
      />
      <ul className="grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.href} className="bg-bg">
            <Link href={tile.href} prefetch={false} className={TILE}>
              <span className="font-display text-4xl text-ink">{formatNumber(tile.value, 0)}</span>
              <span className="text-base text-muted">{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {notes.ok && notes.data.items.length > 0 && (
        <section className="mt-12" aria-labelledby="latest-notes">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="latest-notes" className="font-display text-xl text-ink">
              آخرین اعلان‌ها
            </h2>
            <Link
              href="/account/notifications"
              prefetch={false}
              className="text-sm text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
            >
              همه‌ی اعلان‌ها
            </Link>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {notes.data.items.map((n) => (
              <li key={n.id} className="flex items-baseline justify-between gap-4 py-3.5 text-base">
                <span className={n.readAt ? 'text-muted' : 'text-ink'}>
                  {!n.readAt && (
                    <span className="me-2 inline-block size-1.5 rounded-full bg-accent align-middle" aria-label="خوانده‌نشده" />
                  )}
                  {String(n.payload.name ?? n.payload.listingTitle ?? 'اعلان تازه')}
                </span>
                <time dateTime={n.createdAt} className="shrink-0 text-sm text-muted">
                  {formatRelative(n.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 grid gap-6 border-t border-line pt-10 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-lg text-ink">آگهی ثبت کنید</h2>
          <p className="mt-1.5 text-base text-muted">ملک خود را در چند دقیقه آگهی کنید.</p>
          <Link
            href="/listings/new"
            prefetch={false}
            className="mt-3 inline-block text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
          >
            ثبت آگهی
          </Link>
        </div>
        <div>
          <h2 className="font-display text-lg text-ink">جستجو را ذخیره کنید</h2>
          <p className="mt-1.5 text-base text-muted">با هر آگهی تازه‌ی هم‌خوان خبر بگیرید.</p>
          <Link
            href="/search"
            prefetch={false}
            className="mt-3 inline-block text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
          >
            رفتن به جستجو
          </Link>
        </div>
      </section>
    </>
  );
}