import { formatNumber, type ListingDetail, type ListingDetailMedia } from '@ashian/shared';
import { Images } from '@phosphor-icons/react/ssr';
import { ViewTransition } from 'react';
import { imagesOf, type GalleryImage } from '../../lib/listing';
import { mediaUrl } from '../../lib/media';
import { MediaImage } from '../media-image';
import { GalleryShell, type GalleryPanel } from './gallery-shell';

const EMBED_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|vimeo\.com|matterport\.com|my\.matterport\.com|kuula\.co)$/;

/** آدرس https از میزبان‌های مجاز برای iframe؛ بقیه‌ی منبع‌ها فایل خود سایت‌اند */
function embedUrl(source: string | null): string | null {
  if (!source || !/^https:\/\//.test(source)) return null;
  try {
    return EMBED_HOSTS.test(new URL(source).hostname) ? source : null;
  } catch {
    return null;
  }
}

/** چیدمان موزاییک دسکتاپ بر اساس تعداد عکس: عکس اول بزرگ، بقیه کوچک */
function cellClass(index: number, count: number): string {
  if (index === 0) {
    if (count === 1) return 'md:col-span-4 md:row-span-2';
    return 'md:col-span-2 md:row-span-2';
  }
  if (count === 2) return 'md:col-span-2 md:row-span-2';
  if (count === 3) return 'md:col-span-2';
  if (count === 4 && index === 1) return 'md:col-span-2';
  // از عکس ششم به بعد فقط در نوار موبایل و لایت‌باکس هستند
  if (index > 4) return 'md:hidden';
  return '';
}

function PhotoMosaic({ images, publicId }: { images: GalleryImage[]; publicId: string }) {
  const count = images.length;
  return (
    <div className="relative">
      {/* موبایل: نوار افقی با scroll-snap؛ دسکتاپ: همان عناصر به‌صورت موزاییک (بدون دو بار بارگذاری عکس) */}
      <div
        data-strip
        className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto md:grid md:h-[26rem] md:snap-none md:grid-cols-4 md:grid-rows-2 md:gap-2 md:overflow-hidden lg:h-[32rem]"
      >
        {images.map((image, i) => {
          const button = (
            <button
              key={image.id}
              type="button"
              data-open={`photos:${i}`}
              aria-label={`بزرگ‌نمایی ${image.alt}`}
              className={`group relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden bg-surface-2 md:aspect-auto md:w-auto md:rounded-none ${cellClass(i, count)}`}
            >
              <MediaImage
                variants={null}
                sources={image}
                alt={image.alt}
                sizes={
                  i === 0
                    ? '(min-width: 1280px) 580px, (min-width: 768px) 50vw, 100vw'
                    : '(min-width: 1280px) 290px, (min-width: 768px) 25vw, 100vw'
                }
                width={image.width}
                height={image.height}
                blurhash={image.blurhash}
                priority={i === 0}
                className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </button>
          );
          // انتقال نرم عکس کارت نتایج به همین عکس (View Transitions)
          return i === 0 ? (
            <ViewTransition key={image.id} name={`listing-photo-${publicId}`} share="listing-photo"
              default="none">
              {button}
            </ViewTransition>
          ) : (
            button
          );
        })}
      </div>

      {count > 1 && (
        <>
          <span
            data-strip-counter
            className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-ink/75 px-2.5 py-0.5 font-sans text-xs text-white md:hidden"
          >
            {formatNumber(1, 0)} از {formatNumber(count, 0)}
          </span>
          <button
            type="button"
            data-open="photos:0"
            className="absolute bottom-4 end-4 hidden h-10 items-center gap-2 rounded-sm bg-white px-4 text-sm font-medium text-ink shadow-pop transition-colors duration-150 hover:bg-surface md:inline-flex"
          >
            <Images size={18} aria-hidden />
            نمایش همه‌ی {formatNumber(count, 0)} عکس
          </button>
        </>
      )}
    </div>
  );
}

function FloorplanPanel({ images }: { images: GalleryImage[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {images.map((image, i) => (
        <button
          key={image.id}
          type="button"
          data-open={`floorplan:${i}`}
          aria-label={`بزرگ‌نمایی ${image.alt}`}
          className="group relative aspect-[4/3] overflow-hidden bg-surface-2"
        >
          <MediaImage
            variants={null}
            sources={image}
            alt={image.alt}
            sizes="(min-width: 768px) 50vw, 100vw"
            width={image.width}
            height={image.height}
            blurhash={image.blurhash}
            className="size-full object-contain p-3"
          />
        </button>
      ))}
    </div>
  );
}

function VideoPanel({ item, title }: { item: ListingDetailMedia; title: string }) {
  const embed = embedUrl(item.source);
  const frame = 'aspect-video w-full bg-ink';
  if (embed) {
    return (
      <iframe
        src={embed}
        title={`ویدیوی ${title}`}
        loading="lazy"
        allow="fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        className={frame}
      />
    );
  }
  if (!item.source) return null;
  return (
    <video
      controls
      playsInline
      preload="none"
      src={/^https?:\/\//.test(item.source) ? item.source : mediaUrl(item.source)}
      className={frame}
    >
      مرورگر شما پخش ویدیو را پشتیبانی نمی‌کند.
    </video>
  );
}

function TourPanel({ item, title }: { item: ListingDetailMedia; title: string }) {
  const embed = embedUrl(item.source);
  if (!embed) return null;
  return (
    <iframe
      src={embed}
      title={`تور ۳۶۰ درجه‌ی ${title}`}
      loading="lazy"
      allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
      referrerPolicy="strict-origin-when-cross-origin"
      className="aspect-video w-full bg-ink md:aspect-[16/8]"
    />
  );
}

/**
 * گالری صفحه‌ی آگهی: موزاییک (یک عکس بزرگ + چهار کوچک) با تب‌های عکس / ویدیو / تور ۳۶۰ / نقشه‌ی واحد.
 * همه‌ی عکس‌ها در سرور رندر می‌شوند؛ فقط تب‌ها و لایت‌باکس سمت کلاینت‌اند.
 */
export function Gallery({ listing }: { listing: ListingDetail }) {
  const photos = imagesOf(listing, 'image', (i, n) =>
    n > 1 ? `${listing.title}، عکس ${formatNumber(i + 1, 0)}` : listing.title,
  );
  const plans = imagesOf(listing, 'floorplan', (i, n) =>
    n > 1 ? `نقشه‌ی واحد ${formatNumber(i + 1, 0)}` : 'نقشه‌ی واحد',
  );
  const video = listing.media.find((m) => m.kind === 'video' && m.status === 'ready' && m.source);
  const tour = listing.media.find(
    (m) => m.kind === 'tour360' && m.status === 'ready' && embedUrl(m.source),
  );

  const panels: GalleryPanel[] = [
    {
      id: 'photos',
      label: 'عکس',
      count: photos.gallery.length || undefined,
      content: photos.gallery.length ? (
        <PhotoMosaic images={photos.gallery} publicId={listing.publicId} />
      ) : (
        <div className="flex aspect-[16/7] items-center justify-center bg-surface-2 text-base text-muted">
          برای این آگهی عکسی ثبت نشده است.
        </div>
      ),
    },
  ];
  if (video) {
    panels.push({
      id: 'video',
      label: 'ویدیو',
      content: <VideoPanel item={video} title={listing.title} />,
    });
  }
  if (tour) {
    panels.push({
      id: 'tour',
      label: 'تور ۳۶۰°',
      content: <TourPanel item={tour} title={listing.title} />,
    });
  }
  if (plans.gallery.length) {
    panels.push({
      id: 'floorplan',
      label: 'نقشه‌ی واحد',
      count: plans.gallery.length,
      content: <FloorplanPanel images={plans.gallery} />,
    });
  }

  return (
    <GalleryShell panels={panels} sets={{ photos: photos.lightbox, floorplan: plans.lightbox }} />
  );
}
