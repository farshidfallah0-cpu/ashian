'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** فلش کوچک؛ SVG ساده تا کتابخانه‌ی آیکون وارد bundle کلاینت نشود */
export function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/**
 * پنجره‌ی کوچک زیر دکمه (برای فیلترهای نوار چسبان). با کلیک بیرون یا Escape بسته می‌شود.
 * عمداً بدون Radix: این نوار روی همه‌ی نتایج است و باید سبک بماند.
 */
export function Popover({
  label,
  badge,
  active = false,
  children,
  className,
}: {
  label: ReactNode;
  /** شمارنده یا خلاصه‌ی مقدار فعال */
  badge?: ReactNode;
  active?: boolean;
  children: (api: { close: () => void }) => ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-10 items-center gap-2 rounded-sm border px-3.5 text-sm transition-colors duration-150 ${
          active
            ? 'border-brand bg-brand-soft text-brand'
            : 'border-line-strong bg-bg text-ink hover:border-ink'
        }`}
      >
        <span>{label}</span>
        {badge}
        <Chevron className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute start-0 top-full z-40 mt-2 min-w-64 rounded-md border border-line bg-bg p-4 shadow-pop"
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

/** چیپ انتخابی (برای تعداد خواب، نوع ملک …) */
export function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-sm border px-3.5 text-sm transition-colors duration-150 ${
        selected
          ? 'border-brand bg-brand text-white'
          : 'border-line-strong bg-bg text-ink hover:border-ink'
      }`}
    >
      {children}
    </button>
  );
}
