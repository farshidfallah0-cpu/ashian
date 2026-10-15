'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { apiRequest } from '../../lib/client-api';
import { hrefOf, numberOf, withPatch, type QsValue } from '../../lib/search-url';

export type ViewMode = 'auto' | 'list' | 'map' | 'split';

interface ResultsContext {
  /** query string فعلی (شامل فیلترهای ثابت لندینگ) */
  qs: string;
  view: ViewMode;
  /** تغییر فیلتر/مرتب‌سازی/نما؛ همیشه به /search می‌رود تا فیلترهای ثابت لندینگ هم صریح در URL بیایند */
  navigate: (patch: Record<string, QsValue>, options?: { keepPage?: boolean }) => void;
  /** رفتن به یک query string کامل (برای اعمال پنل فیلترها) */
  go: (qs: string) => void;
  pending: boolean;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  favorites: ReadonlySet<string>;
  toggleFavorite: (publicId: string) => Promise<void>;
}

const Ctx = createContext<ResultsContext | null>(null);

export function useResults(): ResultsContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useResults باید داخل ResultsShell استفاده شود');
  return ctx;
}

/**
 * پوسته‌ی کلاینتی صفحه‌ی نتایج: وضعیت مشترک بین نوار فیلتر، لیست و نقشه
 * (آگهی در حال هاور، علاقه‌مندی‌ها، وضعیت انتظار). خود کارت‌ها همچنان سرور-رندرند و فقط
 * با event delegation به این وضعیت وصل می‌شوند.
 */
export function ResultsShell({
  qs,
  view,
  children,
}: {
  qs: string;
  view: ViewMode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const loggedIn = useRef(false);

  // پیمایش در صفحه‌ی نتایج را همیشه به /search می‌بریم؛ qs از سرور می‌آید و کامل است
  const navigate = useCallback<ResultsContext['navigate']>(
    (patch, options) => {
      const page = options?.keepPage ? { page: numberOf(qs, 'page') ?? 1 } : {};
      const next = withPatch(qs, { ...page, ...patch });
      startTransition(() => router.push(hrefOf('/search', next), { scroll: false }));
    },
    [qs, router],
  );

  const go = useCallback(
    (next: string) =>
      startTransition(() => router.push(hrefOf('/search', next), { scroll: false })),
    [router],
  );

  // انیمیشن ورود کارت‌ها فقط بار اول: بعد از mount، کارت‌های بعدی بدون انیمیشن می‌آیند
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.setAttribute('data-animate', 'false');
  }, []);

  // علاقه‌مندی‌ها: اگر کاربر وارد شده باشد قلب‌ها پر می‌شوند (کوکی نشست روی API)
  useEffect(() => {
    const controller = new AbortController();
    // توکن ۱۵ دقیقه‌ای منقضی شده باشد، apiRequest بی‌صدا نشست را نوسازی می‌کند
    apiRequest('/v1/favorites/ids', { signal: controller.signal })
      .then((r) => (r?.ok ? (r.json() as Promise<{ ids: string[] }>) : null))
      .then((data) => {
        if (!data) return;
        loggedIn.current = true;
        setFavorites(new Set(data.ids));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const toggleFavorite = useCallback(
    async (publicId: string) => {
      if (!loggedIn.current) {
        router.push(`/login?next=${encodeURIComponent(hrefOf('/search', qs))}`);
        return;
      }
      const has = favorites.has(publicId);
      // خوش‌بینانه؛ اگر سرور رد کرد برمی‌گردانیم
      setFavorites((prev) => {
        const next = new Set(prev);
        if (has) next.delete(publicId);
        else next.add(publicId);
        return next;
      });
      const response = await apiRequest(`/v1/favorites/${publicId}`, {
        method: has ? 'DELETE' : 'PUT',
      });
      if (!response?.ok) {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (has) next.add(publicId);
          else next.delete(publicId);
          return next;
        });
      }
    },
    [favorites, qs, router],
  );

  const value = useMemo<ResultsContext>(
    () => ({ qs, view, navigate, go, pending, hoveredId, setHoveredId, favorites, toggleFavorite }),
    [qs, view, navigate, go, pending, hoveredId, favorites, toggleFavorite],
  );

  return (
    <Ctx.Provider value={value}>
      <div ref={root} data-view={view} data-pending={pending || undefined} className="group/shell">
        {children}
      </div>
    </Ctx.Provider>
  );
}
