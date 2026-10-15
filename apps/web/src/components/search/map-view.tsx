'use client';

import { MARKET, formatNumber, formatPrice, type MapResponse } from '@ashian/shared';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useResults } from './results-shell';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
/** سرویس‌دهنده‌ی کاشی از config قابل تعویض است (NEXT_PUBLIC_MAP_STYLE_URL)؛ پیش‌فرض OpenFreeMap */
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

/** اگر سرویس کاشی در دسترس نبود، پین‌ها روی یک پس‌زمینه‌ی ساده هم کار کنند */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#EFEDE8' } }],
};

const PIN_BASE =
  'relative cursor-pointer whitespace-nowrap rounded-full border border-ink/15 bg-white px-2.5 font-sans text-xs font-bold leading-7 text-ink shadow-xs transition-[transform,background-color,color] duration-150 ease-out';
const PIN_ACTIVE = ['bg-ink', 'text-white', 'scale-110', 'z-10'];
const PIN_IDLE = ['bg-white', 'text-ink'];

type Bounds = [west: number, south: number, east: number, north: number];

const boundsOf = (map: MapLibreMap): Bounds => {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
};

function pinElement(label: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = PIN_BASE;
  el.textContent = label;
  return el;
}

function clusterElement(count: number): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  const size = count > 99 ? 'size-12' : 'size-10';
  el.className = `${size} cursor-pointer rounded-full border-2 border-white bg-brand font-sans text-sm font-bold text-white shadow-pop transition-transform duration-150 ease-out hover:scale-110`;
  el.textContent = formatNumber(count, 0);
  el.setAttribute('aria-label', `${formatNumber(count, 0)} آگهی؛ بزرگ‌نمایی`);
  return el;
}

/**
 * نقشه‌ی نتایج با MapLibre: پین‌های قیمت‌دار، خوشه‌ها، هماهنگی هاور با کارت‌ها
 * و دکمه‌ی «جستجو در این محدوده» بعد از جابه‌جایی کاربر.
 */
export default function MapView({
  mapQs,
  initialPoints,
}: {
  mapQs: string;
  initialPoints: Array<[number, number]>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement; id?: string }>());
  const abort = useRef<AbortController | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mapQsRef = useRef(mapQs);
  useEffect(() => {
    mapQsRef.current = mapQs;
  }, [mapQs]);

  const { hoveredId, setHoveredId, navigate, qs } = useResults();
  const [dirty, setDirty] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const draw = useCallback(
    (data: MapResponse, map: MapLibreMap) => {
      const next = new Set<string>();
      const add = (
        key: string,
        make: () => { el: HTMLElement; lngLat: [number, number]; id?: string },
      ) => {
        next.add(key);
        if (markers.current.has(key)) return;
        const { el, lngLat, id } = make();
        const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
        markers.current.set(key, { marker, el, id });
      };

      for (const c of data.clusters) {
        add(`c:${c.lng.toFixed(4)},${c.lat.toFixed(4)}:${c.count}`, () => {
          const el = clusterElement(c.count);
          el.addEventListener('click', () =>
            map.easeTo({ center: [c.lng, c.lat], zoom: Math.min(map.getZoom() + 2, 17) }),
          );
          return { el, lngLat: [c.lng, c.lat] };
        });
      }
      for (const p of data.pins) {
        add(`p:${p.publicId}`, () => {
          const el = pinElement(formatPrice(p.price, { withCurrency: false }));
          el.addEventListener('mouseenter', () => setHoveredId(p.publicId));
          el.addEventListener('mouseleave', () => setHoveredId(null));
          el.addEventListener('click', () => {
            const card = document.querySelector<HTMLElement>(`[data-listing-id="${p.publicId}"]`);
            if (card) {
              card.scrollIntoView({ block: 'center', behavior: 'smooth' });
              card.setAttribute('data-flash', 'true');
              setTimeout(() => card.removeAttribute('data-flash'), 1600);
            } else {
              window.open(`/listings/${p.publicId}`, '_blank', 'noopener');
            }
          });
          return { el, lngLat: [p.lng, p.lat], id: p.publicId };
        });
      }
      for (const [key, entry] of markers.current) {
        if (!next.has(key)) {
          entry.marker.remove();
          markers.current.delete(key);
        }
      }
    },
    [setHoveredId],
  );

  const load = useCallback(
    async (map: MapLibreMap) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const bbox = boundsOf(map)
        .map((n) => n.toFixed(5))
        .join(',');
      const params = new URLSearchParams(mapQsRef.current);
      params.set('bbox', bbox);
      params.set('zoom', map.getZoom().toFixed(2));
      try {
        const response = await fetch(`${API}/v1/search/map?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as MapResponse;
        setTotal(data.total);
        draw(data, map);
      } catch {
        /* لغو یا خطای شبکه؛ پین‌های قبلی می‌مانند */
      }
    },
    [draw],
  );

  // ساخت نقشه (یک بار)
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [...MARKET.map.center] as [number, number],
      zoom: MARKET.map.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');

    let styleOk = false;
    map.on('styledata', () => (styleOk = true));
    map.on('error', () => {
      // سرویس کاشی در دسترس نیست: پس‌زمینه‌ی ساده، پین‌ها همچنان کار می‌کنند
      if (!styleOk) {
        styleOk = true;
        setFailed(true);
        map.setStyle(FALLBACK_STYLE);
      }
    });

    const fit = () => {
      const bbox = new URLSearchParams(qs).get('bbox')?.split(',').map(Number);
      if (bbox?.length === 4 && bbox.every(Number.isFinite)) {
        map.fitBounds(
          [
            [bbox[0]!, bbox[1]!],
            [bbox[2]!, bbox[3]!],
          ],
          { padding: 24, animate: false },
        );
      } else if (initialPoints.length > 1) {
        const bounds = new maplibregl.LngLatBounds(initialPoints[0]!, initialPoints[0]!);
        for (const point of initialPoints) bounds.extend(point);
        map.fitBounds(bounds, { padding: 56, maxZoom: 14, animate: false });
      }
    };
    map.once('load', () => {
      fit();
      void load(map);
    });
    map.on('moveend', (event: { originalEvent?: unknown }) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(map), 250);
      // فقط حرکت خود کاربر دکمه را نشان می‌دهد (نه fitBounds برنامه‌ای)
      if (event.originalEvent) setDirty(true);
    });

    const markerMap = markers.current;
    return () => {
      clearTimeout(timer.current);
      abort.current?.abort();
      for (const entry of markerMap.values()) entry.marker.remove();
      markerMap.clear();
      map.remove();
      mapRef.current = null;
    };
    // نقشه فقط یک بار ساخته می‌شود؛ تغییر فیلتر با effect بعدی پین‌ها را تازه می‌کند
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // فیلتر عوض شد: پین‌های قدیمی را پاک و دوباره بگیر
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    for (const entry of markers.current.values()) entry.marker.remove();
    markers.current.clear();
    setDirty(false);
    void load(map);
  }, [mapQs, load]);

  // هاور کارت ← برجسته شدن پین
  useEffect(() => {
    for (const { el, id } of markers.current.values()) {
      if (!id) continue;
      const active = id === hoveredId;
      el.classList.remove(...(active ? PIN_IDLE : PIN_ACTIVE));
      el.classList.add(...(active ? PIN_ACTIVE : PIN_IDLE));
    }
  }, [hoveredId, total]);

  return (
    <div className="relative size-full">
      <div ref={container} className="size-full" />
      {dirty && (
        <button
          type="button"
          onClick={() => {
            const map = mapRef.current;
            if (!map) return;
            navigate({
              bbox: boundsOf(map)
                .map((n) => n.toFixed(4))
                .join(','),
            });
            setDirty(false);
          }}
          className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-pop transition-transform duration-150 hover:scale-[1.03]"
        >
          جستجو در این محدوده
        </button>
      )}
      {total !== null && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-sm bg-white px-3 py-1.5 text-xs text-ink-2 shadow-xs">
          {formatNumber(total, 0)} آگهی در نقشه
        </div>
      )}
      {failed && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit rounded-sm bg-white px-3 py-1.5 text-xs text-muted shadow-xs">
          کاشی‌های نقشه در دسترس نیست؛ فقط پین‌ها نمایش داده می‌شوند.
        </div>
      )}
    </div>
  );
}
