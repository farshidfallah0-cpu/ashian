import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './spinner';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-classes';

export { buttonClasses, type ButtonSize, type ButtonVariant };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** دکمه‌ی فقط‌آیکون؛ حتماً aria-label بدهید */
  icon?: boolean;
  /** رندر به‌جای عنصر فرزند (مثلاً next/link) */
  asChild?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'dark',
  size = 'md',
  loading = false,
  icon = false,
  asChild = false,
  startIcon,
  endIcon,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={cn(buttonClasses({ variant, size, icon }), className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {/* محتوا در حالت loading جابه‌جا نمی‌شود تا عرض دکمه ثابت بماند (بدون CLS) */}
          <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
            {startIcon}
            {children}
            {endIcon}
          </span>
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-5" />
            </span>
          )}
        </>
      )}
    </Comp>
  );
}
