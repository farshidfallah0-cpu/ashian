'use client';

import { X } from '@phosphor-icons/react/ssr';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * پنجره‌ی گفت‌وگوی بومی (<dialog>): focus trap، Escape و inert بودن پس‌زمینه را خود مرورگر انجام می‌دهد.
 * در موبایل Bottom Sheet و در دسکتاپ پنجره‌ی وسط‌صفحه است. فقط داخل چانک‌های lazy استفاده می‌شود
 * (بعد از اولین کلیک بارگذاری می‌شوند)، پس به JavaScript اولیه‌ی صفحه اضافه نمی‌شود.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // کلیک روی پس‌زمینه (خود dialog، نه محتوا)
        if (event.target === event.currentTarget) ref.current?.close();
      }}
      className="m-auto w-[min(34rem,calc(100%-2rem))] max-w-none overscroll-contain rounded-md bg-bg p-0 text-ink shadow-pop backdrop:bg-overlay max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:rounded-b-none max-sm:animate-sheet-in sm:animate-pop-in"
    >
      <div className="max-h-[90dvh] overflow-y-auto p-6 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="font-display text-xl text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="بستن"
            onClick={() => ref.current?.close()}
            className="-me-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** پاسخ خطای API → پیام فارسی قابل نمایش */
export async function apiErrorMessage(response: Response | null): Promise<string> {
  if (!response) return 'ارتباط با سرور برقرار نشد؛ اینترنت را بررسی و دوباره تلاش کنید.';
  if (response.status === 429) return 'تعداد درخواست‌ها زیاد است؛ چند لحظه بعد دوباره تلاش کنید.';
  try {
    const body = (await response.json()) as { message?: unknown; errors?: Array<{ message?: string }> };
    const first = body.errors?.find((e) => typeof e.message === 'string')?.message;
    if (first) return first;
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message) && typeof body.message[0] === 'string') return body.message[0];
  } catch {
    /* بدنه‌ی JSON نبود */
  }
  return 'درخواست انجام نشد؛ دوباره تلاش کنید.';
}
