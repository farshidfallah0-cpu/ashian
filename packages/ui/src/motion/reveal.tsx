'use client';

import { m, type Variants } from 'motion/react';
import type { ComponentProps } from 'react';
import { slideUp, stagger } from './presets';

type RevealProps = Omit<ComponentProps<typeof m.div>, 'variants' | 'initial' | 'animate'> & {
  variants?: Variants;
  /** تأخیر به ثانیه؛ فقط برای هماهنگی چند عنصر کنار هم */
  delay?: number;
};

/**
 * ورود ملایم هنگام اسکرول؛ فقط یک بار (IntersectionObserver داخل motion).
 * محتوا در HTML سرور کامل است؛ فقط opacity و transform عوض می‌شود، پس CLS صفر است.
 */
export function Reveal({ variants = slideUp, delay = 0, transition, ...props }: RevealProps) {
  return (
    <m.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={delay ? { delay, ...transition } : transition}
      {...props}
    />
  );
}

/** ظرف stagger؛ فرزندان باید m.* با variants (مثل slideUp) باشند */
export function RevealGroup({
  gap = 0.06,
  ...props
}: Omit<ComponentProps<typeof m.div>, 'variants'> & { gap?: number }) {
  return (
    <m.div
      variants={stagger(gap)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      {...props}
    />
  );
}

export { m };
