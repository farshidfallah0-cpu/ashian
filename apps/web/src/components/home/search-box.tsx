'use client';

import { buttonClasses, controlClass } from '@ashian/ui';
import {
  LABELS,
  PROPERTY_TYPES,
  formatNumber,
  formatPrice,
  normalizeForSearch,
  type SuggestItem,
} from '@ashian/shared';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

/** الحاق کلاس‌ها (clsx ساده)؛ cn سیستم دیزاین tailwind-merge می‌کشد که برای این جزیره زیاد است */
const cn = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

/** برچسب بالای فیلد؛ هم‌ریخت FieldShell سیستم دیزاین */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

type Deal = 'rent' | 'sale';

/** سقف بودجه‌ی پیشنهادی (درهم): اجاره‌ی سالانه و قیمت کل خرید */
const BUDGETS: Record<Deal, number[]> = {
  rent: [40_000, 60_000, 80_000, 120_000, 180_000, 250_000, 400_000],
  sale: [500_000, 800_000, 1_200_000, 2_000_000, 3_500_000, 6_000_000, 10_000_000],
};

/** آیکون‌ها در سرور رندر می‌شوند و به‌صورت prop می‌آیند؛ کتابخانه‌ی آیکون وارد bundle کلاینت نمی‌شود */
export interface SearchBoxIcons {
  search: ReactNode;
  caret: ReactNode;
  clear: ReactNode;
}

export interface PopularPlace {
  path: string;
  label: string;
  hint: string;
  count: number;
}

interface PlaceOption {
  path: string;
  label: string;
  hint?: string;
  count?: number;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * این فرم عمداً با عنصرهای بومی (select، input) ساخته شده است: صفحه‌ی اصلی باید سبک بماند و
 * کتابخانه‌ی Popover/Select (Radix) فقط برای چند فیلد، حدود ۴۰ کیلوبایت به bundle اضافه می‌کرد.
 * ظاهر کنترل‌ها همان `controlClass` سیستم دیزاین است.
 */
function NativeSelect({
  label,
  value,
  onChange,
  caret,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  caret: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlClass, 'appearance-none pe-10')}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-muted">
          {caret}
        </span>
      </div>
    </Field>
  );
}

/** فیلد محله با autocomplete (الگوی ARIA combobox/listbox)؛ بدون وابستگی به کتابخانه */
function PlaceField({
  popular,
  value,
  onChange,
  icons,
}: {
  icons: SearchBoxIcons;
  popular: PlaceOption[];
  value: PlaceOption | null;
  onChange: (place: PlaceOption | null) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<PlaceOption[] | null>(null);
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** پیشنهاد از API با debounce کوتاه؛ پاسخ‌های قدیمی دور ریخته می‌شوند */
  function search(text: string) {
    clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setRemote(null);
      return;
    }
    const current = ++requestId.current;
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `${API}/v1/search/suggest?q=${encodeURIComponent(text)}&limit=10`,
        );
        if (!response.ok || current !== requestId.current) return;
        const data = (await response.json()) as { items: SuggestItem[] };
        setRemote(
          data.items
            .filter((i) => i.kind === 'community' || i.kind === 'tower')
            .map((i) => ({
              path: i.ref,
              label: i.label,
              hint: i.sublabel ?? undefined,
              count: i.listingCount,
            })),
        );
      } catch {
        /* پیشنهاد اختیاری است؛ خطا مانع جستجو نمی‌شود */
      }
    }, 160);
  }

  const options = useMemo(() => {
    if (remote) return remote;
    const q = normalizeForSearch(query);
    return q
      ? popular.filter((p) => normalizeForSearch(`${p.label} ${p.hint ?? ''}`).includes(q))
      : popular;
  }, [remote, popular, query]);

  function choose(option: PlaceOption | null) {
    onChange(option);
    setQuery('');
    setRemote(null);
    setOpen(false);
  }

  const shown = open ? query : (value?.label ?? '');
  return (
    <Field label="محله یا برج" htmlFor={id}>
      <div
        className="relative"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">
          {icons.search}
        </span>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={value ? value.label : 'مثلاً دبی مارینا'}
          value={shown}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
            search(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, options.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter' && open && options[active]) {
              event.preventDefault();
              choose(options[active]!);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          className={cn(controlClass, 'ps-11 pe-10', value && !open && 'font-medium')}
        />
        {value && (
          <button
            type="button"
            aria-label="پاک کردن محله"
            onClick={() => choose(null)}
            className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-surface hover:text-ink"
          >
            {icons.clear}
          </button>
        )}
        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-md border border-line bg-bg p-1 shadow-pop"
          >
            {options.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted">
                محله‌ای با این نام پیدا نشد
              </li>
            )}
            {options.map((option, index) => (
              <li
                key={option.path}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.path === value?.path}
                onMouseMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={cn(
                  'flex h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3',
                  index === active && 'bg-surface',
                )}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="truncate text-xs text-muted">{option.hint}</span>
                  )}
                </span>
                {option.count !== undefined && (
                  <span className="shrink-0 text-xs text-muted">
                    {formatNumber(option.count, 0)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}

function DealTab({
  current,
  value,
  onSelect,
  children,
}: {
  current: Deal;
  value: Deal;
  onSelect: (deal: Deal) => void;
  children: ReactNode;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(value)}
      className={cn(
        '-mb-px h-12 border-b-2 text-base transition-colors duration-150',
        selected
          ? 'border-brand font-medium text-ink'
          : 'border-transparent text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** جستجوی اصلی؛ فقط به صفحه‌ی نتایج می‌رود. تنها داده‌ی بارگذاری‌شده، پیشنهاد خودکار است. */
export function SearchBox({ popular, icons }: { popular: PopularPlace[]; icons: SearchBoxIcons }) {
  const router = useRouter();
  const [deal, setDeal] = useState<Deal>('rent');
  const [place, setPlace] = useState<PlaceOption | null>(null);
  const [propertyType, setPropertyType] = useState('all');
  const [budget, setBudget] = useState('any');

  const popularPlaces = useMemo<PlaceOption[]>(
    () => popular.map((p) => ({ path: p.path, label: p.label, hint: p.hint, count: p.count })),
    [popular],
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ dealType: deal });
    if (place) params.set('location', place.path);
    if (propertyType !== 'all') params.set('propertyType', propertyType);
    if (budget !== 'any') params.set('priceMax', budget);
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="جستجوی ملک"
      className="rounded-md border border-line bg-bg shadow-pop"
    >
      <div
        role="tablist"
        aria-label="نوع معامله"
        className="mx-5 flex gap-8 border-b border-line md:mx-7"
      >
        <DealTab current={deal} value="rent" onSelect={setDeal}>
          اجاره
        </DealTab>
        <DealTab current={deal} value="sale" onSelect={setDeal}>
          خرید
        </DealTab>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2 md:p-7 lg:grid-cols-[1.6fr_1fr_1fr_auto] lg:items-end">
        <PlaceField popular={popularPlaces} value={place} onChange={setPlace} icons={icons} />
        <NativeSelect
          label="نوع ملک"
          value={propertyType}
          onChange={setPropertyType}
          caret={icons.caret}
        >
          <option value="all">همه‌ی انواع</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {LABELS.propertyType[type]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          label={deal === 'rent' ? 'سقف اجاره‌ی سالانه' : 'سقف قیمت'}
          value={budget}
          onChange={setBudget}
          caret={icons.caret}
        >
          <option value="any">بدون سقف</option>
          {BUDGETS[deal].map((amount) => (
            <option key={amount} value={String(amount)}>
              تا {formatPrice(amount)}
            </option>
          ))}
        </NativeSelect>
        <button
          type="submit"
          className={`${buttonClasses({ variant: 'primary', size: 'lg' })} w-full md:col-span-2 lg:col-span-1 lg:w-auto`}
        >
          {icons.search}
          جستجو
        </button>
      </div>
    </form>
  );
}
