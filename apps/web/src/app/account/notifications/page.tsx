import { formatNumber, formatRelative, type NotificationDto } from '@ashian/shared';
import Link from 'next/link';
import { PageNav, PanelEmpty, PanelHeading } from '../../../components/account/account-card';
import { MarkRead } from '../../../components/account/mark-read';
import { accountGet, type ApiPage } from '../../../lib/account-api';

export const metadata = { title: 'اعلان‌ها' };

type Props = { searchParams: Promise<{ page?: string }> };

interface SavedSearchPayload {
  name?: string;
  count?: number;
  query?: string;
  listings?: Array<{ publicId: string; title: string; price: string; deal: string }>;
}

function Note({ note }: { note: NotificationDto }) {
  if (note.type === 'saved-search') {
    const p = note.payload as SavedSearchPayload;
    const href = `/search?${p.query ?? ''}${p.query ? '&' : ''}sort=newest`;
    return (
      <>
        <p className="text-base text-ink">
          {formatNumber(p.count ?? 0, 0)} آگهی تازه برای جستجوی «{p.name}»
        </p>
        {p.listings && p.listings.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {p.listings.map((l) => (
              <li key={l.publicId}>
                <Link
                  href={`/listings/${l.publicId}`}
                  prefetch={false}
                  className="hover:underline"
                >
                  {l.title}
                </Link>
                <span className="text-muted"> · {l.price}</span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={href}
          prefetch={false}
          className="mt-2 inline-block text-sm text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
        >
          مشاهده‌ی همه
        </Link>
      </>
    );
  }
  if (note.type === 'lead') {
    const p = note.payload as { listingPublicId?: string; listingTitle?: string; name?: string };
    return (
      <p className="text-base text-ink">
        درخواست تازه{p.name ? ` از ${p.name}` : ''} برای{' '}
        {p.listingPublicId ? (
          <Link href={`/listings/${p.listingPublicId}`} prefetch={false} className="underline">
            {p.listingTitle}
          </Link>
        ) : (
          p.listingTitle
        )}
      </p>
    );
  }
  return <p className="text-base text-ink">اعلان تازه</p>;
}

export default async function NotificationsPage({ searchParams }: Props) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const result = await accountGet<ApiPage<NotificationDto>>(
    `/v1/notifications?page=${page}&pageSize=20`,
  );
  const data = result.ok ? result.data : null;
  const hasUnread = !!data?.items.some((n) => !n.readAt);

  return (
    <>
      <PanelHeading
        title="اعلان‌ها"
        lead="آگهی‌های تازه‌ی جستجوهای ذخیره‌شده و درخواست‌هایی که به شما می‌رسد."
      />
      <MarkRead enabled={hasUnread} />
      {!data || data.items.length === 0 ? (
        <PanelEmpty
          title="اعلانی ندارید"
          text="وقتی برای یک جستجوی ذخیره‌شده آگهی تازه‌ای منتشر شود، اینجا خبرش را می‌بینید."
        />
      ) : (
        <>
          <ul className="divide-y divide-line border-y border-line">
            {data.items.map((note) => (
              <li key={note.id} className="flex gap-4 py-5">
                <span
                  className={`mt-2.5 size-2 shrink-0 rounded-full ${note.readAt ? 'bg-transparent' : 'bg-accent'}`}
                  aria-label={note.readAt ? undefined : 'خوانده‌نشده'}
                />
                <div className="min-w-0 flex-1">
                  <Note note={note} />
                </div>
                <time dateTime={note.createdAt} className="shrink-0 text-sm text-muted">
                  {formatRelative(note.createdAt)}
                </time>
              </li>
            ))}
          </ul>
          <PageNav
            page={data.page}
            totalPages={data.totalPages}
            hrefFor={(p) => `/account/notifications?page=${p}`}
          />
        </>
      )}
    </>
  );
}