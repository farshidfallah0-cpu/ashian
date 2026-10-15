/**
 * کلاس‌های مشترک همه‌ی کنترل‌های تک‌خطی (Input، Select، Combobox).
 * رشته‌ی ساده است (بدون cn/tailwind-merge) تا کامپوننت‌های سبک کلاینت بتوانند بدون
 * کشیدن کتابخانه‌ی merge به bundle از آن استفاده کنند.
 */
export const controlClass = [
  'h-11 w-full rounded-sm border border-line-strong bg-bg px-3.5 text-base text-ink',
  'placeholder:text-faint',
  'transition-[border-color,box-shadow] duration-150 ease-out',
  'hover:border-ink-2',
  'focus-visible:border-brand focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(27_43_75/0.12)]',
  'disabled:cursor-not-allowed disabled:bg-surface disabled:text-faint disabled:hover:border-line-strong',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:shadow-[0_0_0_3px_rgb(194_65_12/0.14)]',
].join(' ');
