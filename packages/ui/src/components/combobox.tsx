'use client';

import { normalizeForSearch, toPersianDigits } from '@ashian/shared';
import { Check, MagnifyingGlass, X } from '@phosphor-icons/react/ssr';
import { Popover } from 'radix-ui';
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { controlClass, FieldShell } from './field';

export interface ComboboxOption {
  value: string;
  label: string;
  /** توضیح کم‌رنگ کنار گزینه، مثل «دبی» برای یک محله */
  hint?: string;
  /** تعداد آگهی؛ با ارقام فارسی نمایش داده می‌شود */
  count?: number;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  emptyText?: string;
  /** حداکثر تعداد گزینه‌ی نمایش‌داده‌شده؛ برای لیست‌های بزرگ */
  limit?: number;
  clearable?: boolean;
  /**
   * هر بار متن تایپ‌شده عوض شد صدا زده می‌شود (برای autocomplete از سرور).
   * همراه با `filterLocally={false}` گزینه‌ها همان‌هایی‌اند که سرور داده است.
   */
  onQueryChange?: (query: string) => void;
  /** فیلتر کردن گزینه‌ها با متن تایپ‌شده در خود کامپوننت؛ برای گزینه‌های سمت سرور خاموش کنید */
  filterLocally?: boolean;
  /** گزینه‌ی انتخاب‌شده را وقتی `options` عوض شده و دیگر شامل آن نیست نگه می‌دارد */
  selectedOption?: ComboboxOption | null;
  id?: string;
  className?: string;
}

/**
 * Combobox با جستجوی فارسی‌محور: «اپارتمان» و «آپارتمان»، «ي» و «ی» یکی حساب می‌شوند.
 * الگوی ARIA 1.2 (combobox + listbox)، فوکوس همیشه روی input می‌ماند.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  label,
  hint,
  error,
  placeholder = 'جستجو…',
  emptyText = 'موردی پیدا نشد',
  limit = 50,
  clearable = true,
  onQueryChange,
  filterLocally = true,
  selectedOption,
  id,
  className,
}: ComboboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? (value ? (selectedOption ?? null) : null),
    [options, value, selectedOption],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const indexed = useMemo(
    () =>
      options.map((o) => ({ option: o, key: normalizeForSearch(`${o.label} ${o.hint ?? ''}`) })),
    [options],
  );

  const results = useMemo(() => {
    const q = normalizeForSearch(query);
    const list = q && filterLocally ? indexed.filter((i) => i.key.includes(q)) : indexed;
    return list.slice(0, limit).map((i) => i.option);
  }, [indexed, query, limit, filterLocally]);

  const commit = useCallback(
    (option: ComboboxOption | null) => {
      onValueChange(option ? option.value : null);
      setQuery('');
      onQueryChange?.('');
      setOpen(false);
    },
    [onValueChange, onQueryChange],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        const option = results[active];
        if (open && option) {
          event.preventDefault();
          commit(option);
        }
        break;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
    }
  };

  const showValue = !open && selected && !query;
  const activeId = open && results[active] ? `${listId}-${active}` : undefined;

  return (
    <FieldShell
      label={label}
      hint={hint}
      error={error}
      htmlFor={inputId}
      hintId={`${inputId}-hint`}
      errorId={`${inputId}-error`}
      className={className}
    >
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div className="relative">
            <MagnifyingGlass
              size={18}
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              ref={inputRef}
              id={inputId}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              placeholder={selected ? selected.label : placeholder}
              value={showValue ? selected.label : query}
              onChange={(e) => {
                setQuery(e.target.value);
                onQueryChange?.(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              className={cn(controlClass, 'ps-11 pe-10', selected && !open && 'font-medium')}
            />
            {clearable && selected && (
              <button
                type="button"
                aria-label="پاک کردن انتخاب"
                onClick={() => {
                  commit(null);
                  inputRef.current?.focus();
                }}
                className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-ink"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (e.target === inputRef.current) e.preventDefault();
            }}
            className={cn(
              'z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-line bg-bg shadow-pop',
              'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            )}
          >
            <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted">{emptyText}</li>
              )}
              {results.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseMove={() => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(option)}
                  className={cn(
                    'flex h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3',
                    index === active && 'bg-surface',
                  )}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className={cn('truncate', option.value === value && 'font-medium')}>
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="truncate text-xs text-muted">{option.hint}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {option.count !== undefined &&
                      toPersianDigits(option.count.toLocaleString('en'))}
                    {option.value === value && (
                      <Check size={16} weight="bold" className="text-brand" />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </FieldShell>
  );
}
