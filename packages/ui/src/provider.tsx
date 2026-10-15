'use client';

import { Direction } from 'radix-ui';
import type { ReactNode } from 'react';
import { TooltipProvider } from './components/tooltip';
import { Toaster } from './components/toast';
import { MotionProvider } from './motion/motion-provider';

/** همه‌ی providerهای لازم کتابخانه؛ یک بار در layout ریشه */
export function UIProvider({ children }: { children: ReactNode }) {
  return (
    <Direction.Provider dir="rtl">
      <MotionProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </MotionProvider>
    </Direction.Provider>
  );
}
