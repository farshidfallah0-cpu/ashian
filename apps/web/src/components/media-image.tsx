import type { MediaVariants } from '@ashian/shared';
import { blurDataUrl } from '../lib/blur';
import { imageSources, type ImageSources } from '../lib/media';

interface MediaImageProps {
  variants: MediaVariants | null | undefined;
  /** srcset از پیش ساخته (جایگزین variants)؛ برای جاهایی که سرور قبلاً آن را حساب کرده */
  sources?: ImageSources | null;
  blurhash?: string | null;
  alt: string;
  /** مثل «(min-width:1024px) 33vw, 100vw»؛ مرورگر بر اساس آن اندازه‌ی مناسب را برمی‌دارد */
  sizes: string;
  width?: number | null;
  height?: number | null;
  /** فقط برای عکس بالای صفحه (LCP) */
  priority?: boolean;
  className?: string;
}

/**
 * عکس رسانه‌ی پردازش‌شده: AVIF و WebP در چند عرض از پیش ساخته شده‌اند، پس بهینه‌ساز Next لازم نیست.
 * تا رسیدن عکس، blurhash به‌صورت پس‌زمینه دیده می‌شود. ابعاد ثابت است (بدون CLS).
 */
export function MediaImage({
  variants,
  sources: precomputed,
  blurhash,
  alt,
  sizes,
  width,
  height,
  priority = false,
  className,
}: MediaImageProps) {
  const sources = precomputed ?? imageSources(variants);
  const placeholder = blurDataUrl(blurhash);
  const style = placeholder
    ? { backgroundImage: `url(${placeholder})`, backgroundSize: 'cover' }
    : undefined;

  if (!sources) {
    return <div role="img" aria-label={alt} className={className} style={style} />;
  }
  return (
    <picture>
      {sources.avif && <source type="image/avif" srcSet={sources.avif} sizes={sizes} />}
      {sources.webp && <source type="image/webp" srcSet={sources.webp} sizes={sizes} />}
      <img
        src={sources.fallback ?? undefined}
        alt={alt}
        width={width ?? 1280}
        height={height ?? 960}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
        className={className}
        style={style}
      />
    </picture>
  );
}
