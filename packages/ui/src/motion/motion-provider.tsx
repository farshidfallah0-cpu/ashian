'use client';

import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * LazyMotion فقط ویژگی‌های لازم را بارگذاری می‌کند (حدود ۵ کیلوبایت به‌جای ۳۰).
 * reducedMotion="user" یعنی اگر کاربر در سیستم‌عامل کاهش انیمیشن را روشن کرده،
 * همه‌ی حرکت‌های transform خودکار خاموش می‌شوند.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
