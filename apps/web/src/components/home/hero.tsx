import { formatNumber } from '@ashian/shared';
import { ArrowLeft } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { Parallax } from './parallax';

/**
 * عکس‌های هیرو CC0 از Wikimedia Commons‌اند (نام عکاس در فوتر و CREDITS آمده است).
 * AVIF/WebP در چند عرض از پیش ساخته شده‌اند؛ بهینه‌ساز Next لازم نیست و عکس اصلی با preload بالا می‌آید.
 */
const HERO_WIDTHS = [960, 1440, 1920, 2560] as const;
const INSET_WIDTHS = [480, 800, 1200] as const;
const set = (name: string, ext: string, widths: readonly number[]) =>
  widths.map((w) => `/hero/${name}-${w}.${ext} ${w}w`).join(', ');

export interface HeroChip {
  label: string;
  href: string;
}

export interface HeroProps {
  chips: HeroChip[];
  /** محله‌ی نمایش‌داده‌شده کنار عکس کوچک؛ اختیاری */
  spotlight?: { name: string; count: number; href: string } | null;
}

/**
 * هیرو تمام‌عرض با عکس افق دبی: تیتر درشت پایین‌چپ‌نشین (راست در RTL)، عکس کوچک نامتقارن با
 * parallax ملایم و چیپ‌های جستجوی پرتکرار. متن روی بخش تیره‌ی عکس (آب) نشسته است تا خوانا بماند.
 */
export function Hero({ chips, spotlight }: HeroProps) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-brand-active text-white"
    >
      {/* preload عکس اصلی؛ فقط فرمت AVIF (مرورگرهای بدون AVIF از <picture> می‌گیرند) */}
      <link
        rel="preload"
        as="image"
        type="image/avif"
        imageSrcSet={set('hero', 'avif', HERO_WIDTHS)}
        imageSizes="100vw"
        fetchPriority="high"
      />
      <picture>
        <source type="image/avif" srcSet={set('hero', 'avif', HERO_WIDTHS)} sizes="100vw" />
        <source type="image/webp" srcSet={set('hero', 'webp', HERO_WIDTHS)} sizes="100vw" />
        <img
          src="/hero/hero-fallback.jpg"
          alt="افق دبی در شب: برج خلیفه و برج‌های بیزنس بی با بازتابشان در آب"
          width={2560}
          height={1707}
          fetchPriority="high"
          decoding="sync"
          className="absolute inset-0 -z-20 size-full object-cover object-[50%_56%]"
        />
      </picture>
      {/* لایه‌ی خنثی برای خوانایی متن؛ بدون رنگ اضافه */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-ink/25" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-3/4 bg-[linear-gradient(to_top,rgb(14_16_20/0.86),rgb(14_16_20/0))]"
      />

      <div className="container-page flex min-h-[34rem] items-end pb-28 pt-28 md:min-h-[40rem] md:pb-32 lg:min-h-[46rem] lg:pb-36">
        <div className="grid w-full items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 text-sm text-white/80">
              <span className="h-px w-8 bg-white/70" aria-hidden />
              اجاره و خرید ملک در دبی، به زبان شما
            </p>
            <h1
              id="hero-title"
              className="mt-5 text-[clamp(2.9rem,7.8vw,5.75rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-white"
            >
              دبی،
              <br />
              خانه به خانه
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/85">
              آگهی‌های تأییدشده با قیمت به درهم و متراژ به فوت مربع؛ هر آگهی با تاریخ انتشار و نام
              مشاورش.
            </p>

            <ul className="mt-8 flex flex-wrap gap-2.5" aria-label="جستجوهای پرتکرار">
              {chips.map((chip) => (
                <li key={chip.href}>
                  <Link
                    href={chip.href}
                    prefetch={false}
                    className="inline-flex h-10 items-center rounded-full border border-white/45 px-4 text-sm text-white transition-colors duration-150 hover:border-white hover:bg-white hover:text-ink"
                  >
                    {chip.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:col-span-4 lg:col-start-9 lg:block">
            <Parallax className="will-change-transform">
              <figure>
                <div className="aspect-[4/5] overflow-hidden rounded-sm bg-brand-hover">
                  <picture>
                    <source
                      type="image/avif"
                      srcSet={set('inset', 'avif', INSET_WIDTHS)}
                      sizes="26vw"
                    />
                    <source
                      type="image/webp"
                      srcSet={set('inset', 'webp', INSET_WIDTHS)}
                      sizes="26vw"
                    />
                    <img
                      src="/hero/inset-fallback.jpg"
                      alt="دبی مارینا هنگام غروب، با برج‌های مسکونی و کانال"
                      width={1200}
                      height={675}
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover object-[62%_50%]"
                    />
                  </picture>
                </div>
                {spotlight && (
                  <figcaption className="mt-3">
                    <Link
                      href={spotlight.href}
                      prefetch={false}
                      className="group flex items-center justify-between gap-4 border-t border-white/35 pt-3 text-white"
                    >
                      <span>
                        <span className="block font-display text-lg">{spotlight.name}</span>
                        <span className="block text-sm text-white/70">
                          {formatNumber(spotlight.count, 0)} آگهی فعال
                        </span>
                      </span>
                      <ArrowLeft
                        size={20}
                        className="transition-transform duration-200 ease-out group-hover:-translate-x-1"
                        aria-hidden
                      />
                    </Link>
                  </figcaption>
                )}
              </figure>
            </Parallax>
          </div>
        </div>
      </div>
    </section>
  );
}
