import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '../lib/cn';
import { controlClass, FieldShell } from './field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** آیکون یا متن در ابتدای فیلد (سمت راست در RTL) */
  start?: ReactNode;
  /** آیکون یا واحد در انتهای فیلد، مثل «درهم» یا «فوت مربع» */
  end?: ReactNode;
  /** برای شماره موبایل، ایمیل و کد: متن چپ‌به‌راست با هم‌ترازی از ابتدا */
  ltr?: boolean;
  wrapperClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  hint,
  error,
  start,
  end,
  ltr,
  className,
  wrapperClassName,
  id,
  ref,
  ...props
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      hintId={hintId}
      errorId={errorId}
      className={wrapperClassName}
    >
      {/* جهت روی ظرف است تا پیشوند (+971) و padding هم‌جهت با متن چپ‌به‌راست شوند */}
      <div className="relative" dir={ltr ? 'ltr' : undefined}>
        {start && (
          <span className="pointer-events-none absolute inset-y-0 start-3.5 flex items-center text-muted">
            {start}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            controlClass,
            start ? (ltr ? 'ps-16' : 'ps-11') : undefined,
            end ? 'pe-14' : undefined,
            className,
          )}
          {...props}
        />
        {end && (
          <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-sm text-muted">
            {end}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

export interface TextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'size'
> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  id,
  ref,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      htmlFor={textareaId}
      hintId={`${textareaId}-hint`}
      errorId={`${textareaId}-error`}
      className={wrapperClassName}
    >
      <textarea
        ref={ref}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        className={cn(controlClass, 'h-auto min-h-28 resize-y py-2.5 leading-[1.8]', className)}
        {...props}
      />
    </FieldShell>
  );
}
