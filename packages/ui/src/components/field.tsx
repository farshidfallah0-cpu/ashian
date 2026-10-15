import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  hintId?: string;
  errorId?: string;
  className?: string;
  children: ReactNode;
}

/** برچسب بالا، توضیح و خطا زیر فیلد. فاصله‌ها ثابت‌اند تا نمایش خطا چیدمان را نپراند. */
export function FieldShell({
  label,
  hint,
  error,
  htmlFor,
  hintId,
  errorId,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { controlClass } from './control-class';
