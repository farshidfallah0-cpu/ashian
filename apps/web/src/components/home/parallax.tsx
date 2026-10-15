'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * parallax بسیار ملایم (حداکثر ±۱۶ پیکسل)، فقط در دسکتاپ و فقط با transform.
 * با «کاهش انیمیشن» در سیستم‌عامل کاملاً خاموش است. روی موبایل هیچ listener ثبت نمی‌شود.
 */
export function Parallax({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desktop = window.matchMedia(
      '(min-width: 1024px) and (prefers-reduced-motion: no-preference)',
    );
    if (!desktop.matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect) return;
      // نسبت جابه‌جایی نسبت به وسط صفحه: -۱ تا ۱
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const shift = Math.max(-1, Math.min(1, progress)) * -16;
      el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}
