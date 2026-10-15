/**
 * کلاس‌های دکمه به‌صورت رشته‌ی ساده، بدون هیچ import (حتی cn): کامپوننت‌های کلاینتِ سبک می‌توانند
 * ظاهر دکمه را بدون کشیدن tailwind-merge و Radix به bundle داشته باشند.
 */
export type ButtonVariant = 'primary' | 'dark' | 'secondary' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap ' +
  'font-medium transition-[transform,background-color,border-color,color,opacity] duration-150 ease-out ' +
  'active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 ' +
  'aria-busy:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  // دکمه‌ی اصلی صفحه: تنها جایی که رنگ تأکید استفاده می‌شود
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active',
  dark: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
  secondary:
    'border border-line-strong bg-bg text-ink hover:border-ink hover:bg-surface active:bg-surface-2',
  // متنی: فقط خط زیر در هاور، بدون پس‌زمینه
  text: 'text-ink underline decoration-line-strong decoration-1 underline-offset-[6px] hover:decoration-ink',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-sm px-3.5 text-sm',
  md: 'h-11 rounded-sm px-5 text-base',
  lg: 'h-[52px] rounded-sm px-7 text-base',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'size-9 rounded-sm',
  md: 'size-11 rounded-sm',
  lg: 'size-[52px] rounded-sm',
};

/** کلاس‌های دکمه به‌صورت رشته (برای لینک‌ها و کلاینت‌های سبک بدون کشیدن cn/tailwind-merge) */
export function buttonClasses({
  variant = 'dark',
  size = 'md',
  icon = false,
}: { variant?: ButtonVariant; size?: ButtonSize; icon?: boolean } = {}): string {
  const textVariant = variant === 'text';
  return [
    base,
    variants[variant],
    !textVariant && (icon ? iconSizes[size] : sizes[size]),
    textVariant && 'h-auto px-0 py-1 text-base',
  ]
    .filter(Boolean)
    .join(' ');
}
