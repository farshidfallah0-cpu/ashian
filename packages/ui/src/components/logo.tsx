import { cn } from '../lib/cn';

/**
 * نشان آشیان: سقف (شیب دوطرفه) روی یک کمان زیر آن، یعنی «لانه».
 * یک خط واحد با ضخامت یکسان؛ بدون گرادیانت.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn('size-8', className)} aria-hidden="true">
      <path
        d="M3.5 14.5 16 4l12.5 10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M8 18.5a8 8 0 0 0 16 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="19.5" r="2" className="fill-accent" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-brand', className)}>
      <LogoMark />
      <span className="font-display text-xl font-extrabold leading-none tracking-tight">آشیان</span>
    </span>
  );
}
