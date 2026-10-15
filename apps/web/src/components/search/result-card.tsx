import { Badge, PriceText, cn } from '@ashian/ui';
import {
  LABELS,
  formatNumber,
  formatRelative,
  sqftToSqm,
  type RentPeriod,
  type SearchHit,
} from '@ashian/shared';
import {
  Bathtub,
  Bed,
  CaretLeft,
  CaretRight,
  ChatCircleDots,
  CubeFocus,
  Heart,
  MapPin,
  Phone,
  Ruler,
  SealCheck,
  VideoCamera,
  WhatsappLogo,
} from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { MediaImage } from '../media-image';
import { CardGallery } from './card-gallery';
import { FavoriteButton } from './favorite-button';

const PERIOD: Partial<Record<SearchHit['dealType'], RentPeriod>> = {
  rent: 'yearly',
  short_term: 'daily',
};

/** پیش‌نمایش گالری در همه‌ی عرض‌ها یکی است؛ مرورگر از sizes اندازه را انتخاب می‌کند */
const SIZES = '(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw';

function MediaChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-ink/75 px-2 text-xs text-white">
      {icon}
      {label}
    </span>
  );
}

/**
 * کارت نتیجه‌ی جستجو (سرور). فقط گالری، قلب و دکمه‌های تماس سمت کلاینت‌اند؛
 * بقیه‌ی کارت HTML ساده است و با event delegation به هاور نقشه وصل می‌شود.
 * تاریخ انتشار و مشاور همیشه دیده می‌شوند و قیمت فقط یک ارز دارد (قوانین محصول).
 */
export function ResultCard({
  listing,
  priority = false,
  index = 0,
}: {
  listing: SearchHit;
  /** اولین عکس صفحه (LCP) */
  priority?: boolean;
  index?: number;
}) {
  const href = `/listings/${listing.publicId}`;
  const place = listing.tower ?? listing.community;
  const agent = listing.agent;
  const sqm = Math.round(sqftToSqm(listing.areaSqft));
  const photos = listing.photos.length
    ? listing.photos
    : listing.cover
      ? [{ ...listing.cover, variants: listing.cover.variants ?? {} }]
      : [];
  const featured = listing.placement === 'featured';

  return (
    <article
      data-listing-id={listing.publicId}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={cn(
        // دو کارت اول بدون انیمیشن ورود تا LCP دیر نشود
        index >= 2 && 'stagger-in',
        'group relative rounded-sm bg-bg transition-[box-shadow,outline-color] duration-200',
        'outline outline-2 outline-offset-4 outline-transparent',
        'data-[hover=true]:outline-ink/60 data-[flash=true]:outline-accent',
      )}
    >
      <div className="relative overflow-hidden rounded-sm bg-surface-2">
        <CardGallery
          count={Math.max(photos.length, 1)}
          previousIcon={<CaretRight size={16} aria-hidden />}
          nextIcon={<CaretLeft size={16} aria-hidden />}
        >
          {(photos.length ? photos : [null]).map((photo, i) => {
            const link = (
            <Link
              key={i}
              href={href}
              prefetch={false}
              tabIndex={i === 0 ? 0 : -1}
              className="relative block aspect-[4/3] w-full shrink-0 snap-center"
              aria-label={i === 0 ? listing.title : undefined}
            >
              <MediaImage
                variants={photo?.variants}
                blurhash={photo?.blurhash}
                width={photo?.width}
                height={photo?.height}
                alt={i === 0 ? listing.title : `${listing.title}، عکس ${formatNumber(i + 1, 0)}`}
                sizes={SIZES}
                priority={priority && i === 0}
                className="size-full object-cover"
              />
            </Link>
            );
            // انتقال نرم همین عکس به گالری صفحه‌ی آگهی (View Transitions؛ بدون پشتیبانی مرورگر، ناوبری ساده)
            return i === 0 ? (
              <ViewTransition
                key={i}
                name={`listing-photo-${listing.publicId}`}
                share="listing-photo"
              default="none"
              >
                {link}
              </ViewTransition>
            ) : (
              link
            );
          })}
        </CardGallery>

        {/* برچسب‌ها، قلب و نشان رسانه روی عکس؛ pointer-events فقط روی دکمه‌ها */}
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {featured && <Badge kind="featured" />}
            {listing.isVerified && <Badge kind="verified" />}
          </div>
          <div className="pointer-events-auto">
            <FavoriteButton
              publicId={listing.publicId}
              title={listing.title}
              icon={<Heart size={18} aria-hidden />}
              activeIcon={<Heart size={18} weight="fill" aria-hidden />}
            />
          </div>
        </div>
        {(listing.media.video || listing.media.tour360 || listing.media.floorplan) && (
          <div className="pointer-events-none absolute bottom-2.5 start-2.5 flex gap-1.5">
            {listing.media.video && <MediaChip icon={<VideoCamera size={14} />} label="ویدیو" />}
            {listing.media.tour360 && <MediaChip icon={<CubeFocus size={14} />} label="۳۶۰°" />}
            {listing.media.floorplan && (
              <MediaChip icon={<Ruler size={14} />} label="نقشه‌ی واحد" />
            )}
          </div>
        )}
      </div>

      <div className="mt-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={href} prefetch={false} className="rounded-sm">
            <PriceText amount={listing.price} period={PERIOD[listing.dealType]} size="lg" />
          </Link>
          <span className="shrink-0 text-xs text-muted">{LABELS.dealType[listing.dealType]}</span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[3.2em] font-sans text-base font-medium leading-[1.6] text-ink">
          <Link href={href} prefetch={false} className="hover:underline">
            {listing.title}
          </Link>
        </h3>

        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
          <MapPin size={15} className="shrink-0" aria-hidden />
          <span className="truncate">
            {place.nameFa}
            {listing.tower && <span>، {listing.community.nameFa}</span>}
          </span>
        </p>

        <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-2">
          <li className="flex items-center gap-1.5">
            <Bed size={18} aria-hidden />
            {listing.bedrooms === 0 ? 'استودیو' : formatNumber(listing.bedrooms, 0)}
            <span className="sr-only">خواب</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Bathtub size={18} aria-hidden />
            {formatNumber(listing.bathrooms, 0)}
            <span className="sr-only">حمام</span>
          </li>
          <li className="flex items-center gap-1.5">
            <Ruler size={18} aria-hidden />
            <span>
              {formatNumber(listing.areaSqft, 0)} فوت
              <span className="text-muted"> ({formatNumber(sqm, 0)} متر)</span>
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-medium text-brand"
          >
            {(agent?.name ?? 'م').trim().charAt(0)}
          </span>
          <div className="min-w-0 text-xs">
            <p className="flex items-center gap-1 truncate text-sm text-ink">
              <span className="truncate">{agent?.name ?? 'مالک'}</span>
              {agent?.isVerified && (
                <SealCheck
                  size={15}
                  weight="fill"
                  className="shrink-0 text-verified"
                  aria-label="مشاور تأییدشده"
                />
              )}
            </p>
            <p className="truncate text-muted">
              {agent?.isTopAgent && <span className="text-brand">مشاور برتر · </span>}
              {listing.publishedAt && (
                <time dateTime={listing.publishedAt}>{formatRelative(listing.publishedAt)}</time>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {(
            [
              ['call', 'تماس', <Phone key="p" size={17} aria-hidden />],
              ['whatsapp', 'واتساپ', <WhatsappLogo key="w" size={17} aria-hidden />],
              ['message', 'پیام', <ChatCircleDots key="m" size={17} aria-hidden />],
            ] as const
          ).map(([action, label, icon]) => (
            <Link
              key={action}
              href={`${href}?contact=${action}#contact`}
              prefetch={false}
              aria-label={`${label} با ${agent?.name ?? 'آگهی‌دهنده'}`}
              className="flex size-9 items-center justify-center rounded-sm border border-line-strong text-ink transition-colors duration-150 hover:border-ink hover:bg-surface"
            >
              {icon}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
