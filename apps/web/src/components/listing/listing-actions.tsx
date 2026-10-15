'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { apiRequest } from '../../lib/client-api';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

const COMPARE_KEY = 'ashian:compare';
const MAX_COMPARE = 4;

const ReportDialog = dynamic(() => import('./report-dialog'), { ssr: false });

const COMPARE_EVENT = 'ashian:compare';

/** فهرست مقایسه در localStorage (مرحله‌ی ۸ همین کلید را می‌خواند)؛ با useSyncExternalStore خوانده می‌شود */
const compareStore = {
  subscribe(callback: () => void) {
    window.addEventListener('storage', callback);
    window.addEventListener(COMPARE_EVENT, callback);
    return () => {
      window.removeEventListener('storage', callback);
      window.removeEventListener(COMPARE_EVENT, callback);
    };
  },
  snapshot(): string {
    try {
      return localStorage.getItem(COMPARE_KEY) ?? '[]';
    } catch {
      return '[]';
    }
  },
  serverSnapshot: () => '[]',
};

function parseCompare(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const itemClass =
  'inline-flex h-10 items-center gap-2 rounded-sm px-3 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink aria-pressed:text-ink';

/**
 * اشتراک‌گذاری، ذخیره، مقایسه و گزارش. آیکون‌ها از سرور می‌آیند (کتابخانه‌ی آیکون وارد bundle نمی‌شود)
 * و فرم گزارش فقط بعد از اولین کلیک بارگذاری می‌شود.
 */
export function ListingActions({
  publicId,
  title,
  icons,
}: {
  publicId: string;
  title: string;
  icons: {
    share: ReactNode;
    heart: ReactNode;
    heartFilled: ReactNode;
    compare: ReactNode;
    flag: ReactNode;
  };
}) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const compareRaw = useSyncExternalStore(
    compareStore.subscribe,
    compareStore.snapshot,
    compareStore.serverSnapshot,
  );
  const compared = parseCompare(compareRaw);
  const [status, setStatus] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/v1/favorites/ids', { signal: controller.signal })
      .then((r) => (r?.ok ? (r.json() as Promise<{ ids: string[] }>) : null))
      .then((data) => {
        if (!data) return;
        setLoggedIn(true);
        setSaved(data.ids.includes(publicId));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [publicId]);

  const flash = useCallback((text: string) => {
    setStatus(text);
    window.setTimeout(() => setStatus(''), 2600);
  }, []);

  async function share() {
    const url = window.location.href.split('#')[0]!;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash('پیوند آگهی کپی شد');
    } catch {
      /* کاربر اشتراک‌گذاری را بست */
    }
  }

  async function toggleSaved() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const next = !saved;
    setSaved(next);
    const response = await apiRequest(`/v1/favorites/${publicId}`, {
      method: next ? 'PUT' : 'DELETE',
    });
    if (!response?.ok) {
      setSaved(!next);
      flash('ذخیره انجام نشد؛ دوباره تلاش کنید');
    } else {
      flash(next ? 'به علاقه‌مندی‌ها اضافه شد' : 'از علاقه‌مندی‌ها حذف شد');
    }
  }

  function toggleCompare() {
    const current = parseCompare(compareStore.snapshot());
    const has = current.includes(publicId);
    if (!has && current.length >= MAX_COMPARE) {
      flash(`حداکثر ${MAX_COMPARE.toLocaleString('fa-IR')} ملک را می‌توان مقایسه کرد`);
      return;
    }
    const next = has ? current.filter((id) => id !== publicId) : [...current, publicId];
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(next));
    } catch {
      /* حالت خصوصی مرورگر */
    }
    window.dispatchEvent(new Event(COMPARE_EVENT));
    flash(has ? 'از مقایسه حذف شد' : 'به مقایسه اضافه شد');
  }

  const inCompare = compared.includes(publicId);

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 -ms-3">
      <button type="button" onClick={() => void share()} className={itemClass}>
        {icons.share}
        اشتراک‌گذاری
      </button>
      <button type="button" aria-pressed={saved} onClick={() => void toggleSaved()} className={itemClass}>
        {saved ? icons.heartFilled : icons.heart}
        {saved ? 'ذخیره شد' : 'ذخیره'}
      </button>
      <button type="button" aria-pressed={inCompare} onClick={toggleCompare} className={itemClass}>
        {icons.compare}
        {inCompare ? `در مقایسه (${compared.length.toLocaleString('fa-IR')})` : 'مقایسه'}
      </button>
      <button type="button" onClick={() => setReporting(true)} className={itemClass}>
        {icons.flag}
        گزارش
      </button>
      <span role="status" aria-live="polite" className="ms-2 text-sm text-verified">
        {status}
      </span>
      {reporting && <ReportDialog publicId={publicId} onClose={() => setReporting(false)} />}
    </div>
  );
}
