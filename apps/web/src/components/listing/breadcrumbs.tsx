import { LABELS, type ListingDetail } from '@ashian/shared';
import { CaretLeft } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { communityHref, dealHref } from '../../lib/listing-seo';

/** مسیر صفحه: خانه ‹ نوع معامله ‹ محله ‹ برج (اگر باشد). آخرین مورد، خود آگهی است. */
export function Breadcrumbs({ listing }: { listing: ListingDetail }) {
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: 'آشیان', href: '/' },
    { label: LABELS.dealType[listing.dealType], href: dealHref(listing) },
    { label: listing.community.nameFa, href: communityHref(listing) },
  ];
  if (listing.place.type === 'tower') crumbs.push({ label: listing.place.nameFa });

  return (
    <nav aria-label="مسیر صفحه" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {crumbs.map((crumb, i) => (
          <li key={crumb.label} className="flex items-center gap-1.5">
            {i > 0 && <CaretLeft size={12} aria-hidden className="text-faint" />}
            {crumb.href ? (
              <Link href={crumb.href} prefetch={false} className="hover:text-ink hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink-2">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
