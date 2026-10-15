'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

export interface MapMarker {
  lng: number;
  lat: number;
  label: string;
}

const FRAME = 'relative h-72 w-full overflow-hidden rounded-sm bg-surface-2 md:h-96';

const Inner = dynamic(() => import('./location-map-inner'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return <div className="skeleton size-full rounded-none" aria-hidden />;
}

/**
 * جای نقشه در HTML ثابت است (بدون CLS)؛ MapLibre (حدود ۲۰۰ کیلوبایت) فقط وقتی کاربر
 * نزدیک این بخش اسکرول کند بارگذاری می‌شود و جزو JavaScript اولیه‌ی صفحه نیست.
 */
export function LocationMap({
  lng,
  lat,
  markers,
  title,
}: {
  lng: number;
  lat: number;
  markers: MapMarker[];
  title: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      // مرورگر بسیار قدیمی: بدون نظارت، نقشه بلافاصله بعد از mount بارگذاری می‌شود
      queueMicrotask(() => setNear(true));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className={FRAME} role="region" aria-label={`نقشه‌ی موقعیت ${title}`}>
      {near ? <Inner lng={lng} lat={lat} markers={markers} /> : <MapSkeleton />}
    </div>
  );
}
