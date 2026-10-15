'use client';

import dynamic from 'next/dynamic';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useResults } from './results-shell';

/** نقشه فقط وقتی دیده می‌شود بارگذاری می‌شود؛ MapLibre حدود ۲۰۰ کیلوبایت است */
const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-surface-2 text-sm text-muted">
      در حال بارگذاری نقشه…
    </div>
  ),
});

function useWide(query = '(min-width: 1280px)'): boolean {
  const subscribe = (notify: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', notify);
    return () => mql.removeEventListener('change', notify);
  };
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * چیدمان لیست و نقشه. در دسکتاپ (≥۱۲۸۰) حالت پیش‌فرض ترکیبی است: لیست سمت راست، نقشه‌ی چسبان سمت چپ.
 * در موبایل نقشه تمام‌صفحه است و با دکمه‌ی شناور بین لیست و نقشه جابه‌جا می‌شود.
 */
export function ResultsBody({
  list,
  mapQs,
  initialPoints,
  icons,
}: {
  list: ReactNode;
  /** فقط فیلترها (بدون صفحه و مرتب‌سازی) برای endpoint نقشه */
  mapQs: string;
  /** مختصات آگهی‌های صفحه‌ی فعلی [lng, lat] برای دید اولیه‌ی نقشه */
  initialPoints: Array<[number, number]>;
  icons: { map: ReactNode; list: ReactNode };
}) {
  const { view, navigate, setHoveredId } = useResults();
  const wide = useWide();
  const mapActive = view === 'map' || (wide && view !== 'list');

  // کارت در حال هاور از سمت نقشه برجسته می‌شود (و برعکس) بدون دوباره‌رندر کارت‌های سرور
  const { hoveredId } = useResults();
  useEffect(() => {
    if (!hoveredId) return;
    const el = document.querySelector<HTMLElement>(`[data-listing-id="${hoveredId}"]`);
    el?.setAttribute('data-hover', 'true');
    return () => el?.removeAttribute('data-hover');
  }, [hoveredId]);

  const listClass = view === 'map' ? 'hidden' : '';
  const mapClass = view === 'list' ? 'hidden' : view === 'map' ? 'block' : 'hidden xl:block';
  const gridClass =
    view === 'list' || view === 'map' ? '' : 'xl:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]';

  return (
    <>
      <div className={`grid grid-cols-1 gap-x-8 ${gridClass}`}>
        <div
          className={listClass}
          onMouseOver={(event) => {
            const card = (event.target as HTMLElement).closest<HTMLElement>('[data-listing-id]');
            setHoveredId(card?.dataset.listingId ?? null);
          }}
          onMouseLeave={() => setHoveredId(null)}
        >
          {list}
        </div>

        <div className={mapClass}>
          <div
            className={
              view === 'map'
                ? 'h-[calc(100dvh-9.5rem)] overflow-hidden rounded-sm border border-line'
                : 'sticky top-[8.5rem] h-[calc(100dvh-10rem)] overflow-hidden rounded-sm border border-line'
            }
          >
            {mapActive && <MapView mapQs={mapQs} initialPoints={initialPoints} />}
          </div>
        </div>
      </div>

      {/* دکمه‌ی شناور لیست/نقشه، فقط موبایل و تبلت */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center xl:hidden">
        <button
          type="button"
          onClick={() => navigate({ view: view === 'map' ? null : 'map' }, { keepPage: true })}
          className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-base font-medium text-white shadow-pop active:scale-[0.98]"
        >
          {view === 'map' ? icons.list : icons.map}
          {view === 'map' ? 'لیست' : 'نقشه'}
        </button>
      </div>
    </>
  );
}
