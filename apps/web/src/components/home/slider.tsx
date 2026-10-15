'use client';

import { buttonClasses } from '@ashian/ui';
import { useRef, type ReactNode } from 'react';

/**
 * اسلایدر افقی با scroll-snap و اسکرول نرم مرورگر (بدون کتابخانه).
 * روی موبایل با لمس حرکت می‌کند؛ دکمه‌ها فقط در دسکتاپ دیده می‌شوند.
 * در راست‌چین، «بعدی» یعنی به سمت چپ.
 */
export function Slider({
  children,
  label,
  previousIcon,
  nextIcon,
}: {
  children: ReactNode;
  label: string;
  /** آیکون‌ها در سرور رندر می‌شوند (کتابخانه‌ی آیکون وارد bundle کلاینت نمی‌شود) */
  previousIcon: ReactNode;
  nextIcon: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);

  function scroll(direction: 'next' | 'previous') {
    const el = track.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.8, 280);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // در RTL مقدار scrollLeft منفی است؛ «بعدی» = به چپ = منفی
    el.scrollBy({
      left: direction === 'next' ? -step : step,
      behavior: reduced ? 'auto' : 'smooth',
    });
  }

  return (
    <div className="relative">
      <div className="mb-5 hidden justify-end gap-2 md:flex">
        <button
          type="button"
          aria-label="قبلی"
          onClick={() => scroll('previous')}
          className={buttonClasses({ variant: 'secondary', size: 'sm', icon: true })}
        >
          {previousIcon}
        </button>
        <button
          type="button"
          aria-label="بعدی"
          onClick={() => scroll('next')}
          className={buttonClasses({ variant: 'secondary', size: 'sm', icon: true })}
        >
          {nextIcon}
        </button>
      </div>
      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-none relative -mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-6 md:px-0"
      >
        {children}
      </div>
    </div>
  );
}
