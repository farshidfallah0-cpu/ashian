'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

/**
 * ورود ملایم هنگام اسکرول، فقط یک بار (IntersectionObserver)، فقط opacity و transform.
 * بدون کتابخانه‌ی انیمیشن؛ حدود ۰٫۵ کیلوبایت.
 *
 * محتوا در HTML سرور کامل و دیده‌شدنی است. فقط بعد از hydration، بخش‌هایی که زیر صفحه‌اند
 * پنهان می‌شوند تا هنگام رسیدن ظاهر شوند؛ پس بدون JavaScript هم هیچ چیز گم نمی‌شود،
 * و چون این بخش‌ها بیرون از دید هستند هیچ پرشی (CLS) رخ نمی‌دهد.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** ثانیه؛ فقط برای هماهنگی چند عنصر کنار هم */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // بخشی که همین حالا دیده می‌شود دست نمی‌خورد
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    el.dataset.reveal = 'hidden';
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        el.dataset.reveal = 'shown';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}s` } : undefined;
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
