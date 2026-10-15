'use client';

import { formatNumber } from '@ashian/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * گالری کارت: scroll-snap افقی (سوایپ طبیعی لمسی) + شمارنده + دکمه‌های قبلی/بعدی در هاور.
 * اسلایدها (عکس‌ها) در سرور رندر می‌شوند و به‌صورت children می‌آیند؛ این جزیره فقط شمارنده و دکمه‌هاست.
 */
export function CardGallery({
  children,
  count,
  previousIcon,
  nextIcon,
}: {
  children: ReactNode;
  count: number;
  /** آیکون‌ها در سرور رندر می‌شوند تا کتابخانه‌ی آیکون وارد bundle کلاینت نشود */
  previousIcon: ReactNode;
  nextIcon: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el || count < 2) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // در RTL مقدار scrollLeft منفی است
        setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  function go(delta: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // «بعدی» در راست‌چین یعنی به سمت چپ
    el.scrollBy({ left: -delta * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  }

  return (
    <div className="group/gallery relative">
      <div
        ref={track}
        className="scrollbar-none relative flex snap-x snap-mandatory overflow-x-auto"
      >
        {children}
      </div>
      {count > 1 && (
        <>
          <span className="pointer-events-none absolute bottom-2.5 end-2.5 rounded-full bg-ink/75 px-2.5 py-0.5 font-sans text-xs text-white">
            {formatNumber(index + 1, 0)} از {formatNumber(count, 0)}
          </span>
          <button
            type="button"
            aria-label="عکس قبلی"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="absolute end-2.5 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-xs transition-opacity duration-150 hover:bg-surface group-hover/gallery:opacity-100 disabled:hidden [@media(hover:hover)]:flex"
          >
            {previousIcon}
          </button>
          <button
            type="button"
            aria-label="عکس بعدی"
            onClick={() => go(1)}
            disabled={index >= count - 1}
            className="absolute start-2.5 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink opacity-0 shadow-xs transition-opacity duration-150 hover:bg-surface group-hover/gallery:opacity-100 disabled:hidden [@media(hover:hover)]:flex"
          >
            {nextIcon}
          </button>
        </>
      )}
    </div>
  );
}
