import type { SearchCard } from '@ashian/shared';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ListingCard } from '../listing-card';
import { Slider } from '../home/slider';

/** اسلایدر کارت‌ها (آگهی‌های مشابه یا دیگر آگهی‌های مشاور) */
export function RelatedListings({
  id,
  title,
  lead,
  listings,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  lead?: string;
  listings: SearchCard[];
  href?: string;
  linkLabel?: string;
}): ReactNode {
  if (listings.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-title`} className="border-t border-line py-12 md:py-14">
      <div className="container-page">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div>
            <h2 id={`${id}-title`} className="font-display text-2xl text-ink">
              {title}
            </h2>
            {lead && <p className="mt-1.5 text-base text-muted">{lead}</p>}
          </div>
          {href && linkLabel && (
            <Link
              href={href}
              prefetch={false}
              className="hidden shrink-0 text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink md:inline"
            >
              {linkLabel}
            </Link>
          )}
        </div>
        <Slider
          label={title}
          previousIcon={<CaretRight size={16} aria-hidden />}
          nextIcon={<CaretLeft size={16} aria-hidden />}
        >
          {listings.map((listing) => (
            <ListingCard
              key={listing.publicId}
              listing={listing}
              className="w-[17.5rem] shrink-0 snap-start sm:w-[19rem]"
              sizes="(min-width: 640px) 304px, 280px"
            />
          ))}
        </Slider>
      </div>
    </section>
  );
}
