'use client';

import { controlClass } from '@ashian/ui';
import { useId, type ReactNode } from 'react';

/** عنوان مرحله */
export function StepHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-2xl text-ink md:text-3xl">{title}</h1>
      {lead && <p className="mt-2 max-w-xl text-base text-muted">{lead}</p>}
    </div>
  );
}

/** گروه فیلد با برچسب، راهنما و خطا */
export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** انتخاب تکی با دکمه‌های رادیویی ظاهرسازی‌شده */
export function Choice<T extends string | number>({
  legend,
  options,
  value,
  onChange,
  error,
  columns = 'grid-cols-2 sm:grid-cols-4',
}: {
  legend: string;
  options: ReadonlyArray<{ value: T; label: ReactNode; sub?: string }>;
  value: T | null;
  onChange: (value: T) => void;
  error?: string | null;
  columns?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink">{legend}</legend>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={`flex cursor-pointer flex-col justify-center rounded-sm border px-4 py-3 text-base transition-colors duration-150 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                checked
                  ? 'border-ink bg-surface text-ink'
                  : 'border-line-strong text-ink-2 hover:border-ink'
              }`}
            >
              <input
                type="radio"
                name={legend}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="font-medium">{option.label}</span>
              {option.sub && <span className="mt-0.5 text-sm text-muted">{option.sub}</span>}
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** شمارنده‌ی +/− برای تعداد خواب، حمام و پارکینگ */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format,
  error,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  error?: string | null;
}) {
  const shown = value ?? min;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      <div
        className={`inline-flex h-11 items-center rounded-sm border ${error ? 'border-danger' : 'border-line-strong'}`}
        role="group"
        aria-label={label}
      >
        <button
          type="button"
          aria-label={`کمتر (${label})`}
          disabled={value !== null && shown <= min}
          onClick={() => onChange(Math.max(min, shown - 1))}
          className="flex size-11 items-center justify-center text-xl text-ink-2 hover:bg-surface disabled:opacity-30"
        >
          −
        </button>
        <output className="min-w-16 px-2 text-center font-sans text-base text-ink" aria-live="polite">
          {value === null ? '—' : format ? format(value) : value.toLocaleString('fa-IR')}
        </output>
        <button
          type="button"
          aria-label={`بیشتر (${label})`}
          disabled={shown >= max}
          onClick={() => onChange(value === null ? min : Math.min(max, shown + 1))}
          className="flex size-11 items-center justify-center text-xl text-ink-2 hover:bg-surface disabled:opacity-30"
        >
          +
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = `${controlClass}`;

/** نوار هشدار (داده‌ی غیرعادی) */
export function WarningBox({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div role="status" className="rounded-sm border border-accent/40 bg-accent-soft px-4 py-3.5">
      <p className="text-sm font-bold text-accent-active">پیش از ادامه بررسی کنید</p>
      <ul className="mt-1.5 space-y-1 text-base text-ink-2">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}