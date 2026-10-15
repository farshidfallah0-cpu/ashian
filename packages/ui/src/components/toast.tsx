'use client';

import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react/ssr';
import { Toast as ToastPrimitive } from 'radix-ui';
import { useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** میلی‌ثانیه؛ پیش‌فرض ۵ ثانیه */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

// یک store ساده‌ی خارج از React تا toast() از هرجا (حتی خارج از کامپوننت) صدا زده شود
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(options: ToastOptions): number {
  const id = nextId++;
  // حداکثر ۳ پیام هم‌زمان؛ قدیمی‌ترین کنار می‌رود
  items = [...items, { id, ...options }].slice(-3);
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => items;
// باید همیشه همان ارجاع برگردد، وگرنه React هشدار حلقه‌ی بی‌نهایت می‌دهد
const EMPTY: ToastItem[] = [];
const getServerSnapshot = () => EMPTY;

const toneIcon: Record<ToastTone, ReactNode> = {
  neutral: <Info size={20} className="text-ink-2" />,
  success: <CheckCircle size={20} weight="fill" className="text-verified" />,
  error: <WarningCircle size={20} weight="fill" className="text-danger" />,
};

/** یک بار در ریشه‌ی برنامه قرار دهید (UIProvider این کار را می‌کند). */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <ToastPrimitive.Provider swipeDirection="down" duration={5000} label="اعلان">
      {list.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          duration={t.duration}
          onOpenChange={(open) => {
            if (!open) dismissToast(t.id);
          }}
          className={cn(
            'flex items-start gap-3 rounded-md border border-line bg-bg p-4 shadow-pop',
            'data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out',
            'data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)]',
            'data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform',
          )}
        >
          <span className="mt-0.5 shrink-0">{toneIcon[t.tone ?? 'neutral']}</span>
          <div className="min-w-0 flex-1">
            <ToastPrimitive.Title className="text-base font-medium text-ink">
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="mt-0.5 text-sm text-muted">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            aria-label="بستن"
            className="-me-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-ink"
          >
            <X size={14} />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-[70] m-0 flex list-none flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] outline-none md:inset-x-auto md:start-4 md:bottom-4 md:w-96 md:p-0" />
    </ToastPrimitive.Provider>
  );
}
