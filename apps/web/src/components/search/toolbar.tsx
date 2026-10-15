'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { filtersOnly, hrefOf } from '../../lib/search-url';
import { useResults } from './results-shell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** برچسب‌ها اینجا تکرار شده‌اند: import از اسکیمای shared مشترکاً zod را وارد bundle کلاینت می‌کند */
const SORTS = [
  ['relevance', 'مرتبط‌ترین'],
  ['newest', 'جدیدترین'],
  ['price_asc', 'ارزان‌ترین'],
  ['price_desc', 'گران‌ترین'],
  ['area_desc', 'بیشترین متراژ'],
] as const;

/** مرتب‌سازی، «تأییدشده‌ها اول» و ذخیره‌ی جستجو/هشدار */
export function Toolbar({ heading }: { heading: string }) {
  const { qs, navigate, pending } = useResults();
  const router = useRouter();
  const params = new URLSearchParams(qs);
  const sort = params.get('sort') ?? 'relevance';
  const verifiedFirst = params.get('verifiedFirst') === '1';
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  async function save() {
    setSaved('saving');
    try {
      const response = await fetch(`${API}/v1/saved-searches`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: heading, query: filtersOnly(qs), frequency: 'daily' }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(hrefOf('/search', qs))}`);
        return;
      }
      setSaved(response.ok ? 'done' : 'error');
    } catch {
      setSaved('error');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3" aria-busy={pending}>
      <label className="flex items-center gap-2 text-sm text-muted">
        مرتب‌سازی
        <select
          value={sort}
          onChange={(e) => navigate({ sort: e.target.value })}
          className="h-10 rounded-sm border border-line-strong bg-bg px-3 text-sm text-ink focus-visible:border-brand focus-visible:outline-none"
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          role="switch"
          checked={verifiedFirst}
          onChange={(e) => navigate({ verifiedFirst: e.target.checked })}
          className="size-5 accent-[var(--color-verified)]"
        />
        تأییدشده‌ها اول
      </label>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saved === 'saving' || saved === 'done'}
        className="ms-auto inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong px-4 text-sm text-ink transition-colors duration-150 hover:border-ink disabled:opacity-70"
      >
        {saved === 'done'
          ? 'جستجو ذخیره شد'
          : saved === 'error'
            ? 'ذخیره نشد؛ دوباره'
            : 'ذخیره‌ی جستجو و هشدار'}
      </button>
      <span className="sr-only" aria-live="polite">
        {saved === 'done' ? 'جستجو ذخیره شد' : ''}
      </span>
    </div>
  );
}
