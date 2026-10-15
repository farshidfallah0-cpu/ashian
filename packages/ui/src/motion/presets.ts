import type { Transition, Variants } from 'motion/react';

/**
 * قواعد موشن آشیان: فقط transform و opacity، بین ۱۵۰ تا ۳۵۰ میلی‌ثانیه،
 * بدون تأخیر در نمایش محتوا و بدون جابه‌جایی چیدمان.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = { fast: 0.15, base: 0.22, slow: 0.35 } as const;

export const transition: Record<'fast' | 'base' | 'slow', Transition> = {
  fast: { duration: DURATION.fast, ease: EASE_OUT },
  base: { duration: DURATION.base, ease: EASE_OUT },
  slow: { duration: DURATION.slow, ease: EASE_OUT },
};

/** حرکت فنری ملایم برای layout و چیپ‌ها؛ بدون جهش */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 };

const hidden = { opacity: 0 };

export const fade: Variants = {
  hidden,
  visible: { opacity: 1, transition: transition.base },
};

/** مسافت کوتاه؛ هدف نمایش آرام است نه نمایش حرکت */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: transition.slow },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: transition.slow },
};

/** جهت‌دار برای راست‌چین: «start» از سمت شروع متن وارد می‌شود (در RTL از راست) */
export function slideInline(side: 'start' | 'end', dir: 'rtl' | 'ltr' = 'rtl'): Variants {
  const sign = (side === 'start' ? -1 : 1) * (dir === 'rtl' ? -1 : 1);
  return {
    hidden: { opacity: 0, x: 16 * sign },
    visible: { opacity: 1, x: 0, transition: transition.slow },
  };
}

export const scale: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: transition.base },
};

/** ظرفی که فرزندانش را پشت‌سرهم وارد می‌کند */
export function stagger(gap = 0.05, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: { transition: { staggerChildren: gap, delayChildren } },
  };
}

/** نسخه‌ی بدون حرکت وقتی کاربر کاهش انیمیشن خواسته */
export const noMotion: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};
