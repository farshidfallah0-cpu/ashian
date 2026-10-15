'use client';

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type { MapMarker } from './location-map';

/** سرویس‌دهنده‌ی کاشی از config قابل تعویض است (NEXT_PUBLIC_MAP_STYLE_URL) */
const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

/** اگر سرویس کاشی در دسترس نبود، پین‌ها روی پس‌زمینه‌ی ساده دیده می‌شوند */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#EFEDE8' } }],
};

const ZOOM = 14.2;

function propertyPin(): HTMLElement {
  const el = document.createElement('div');
  el.className =
    'flex size-9 items-center justify-center rounded-full border-[3px] border-white bg-brand shadow-pop';
  el.innerHTML = '<span class="size-2.5 rounded-full bg-white"></span>';
  return el;
}

function placePill(label: string): HTMLElement {
  const el = document.createElement('div');
  el.className =
    'max-w-48 truncate whitespace-nowrap rounded-full border border-ink/15 bg-white px-2.5 font-sans text-xs leading-6 text-ink-2 shadow-xs';
  el.textContent = label;
  return el;
}

export default function LocationMapInner({
  lng,
  lat,
  markers,
}: {
  lng: number;
  lat: number;
  markers: MapMarker[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: ZOOM,
      attributionControl: { compact: true },
      // اسکرول صفحه نباید با زوم نقشه قاپ زده شود
      cooperativeGestures: true,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'برای بزرگ‌نمایی، Ctrl را نگه دارید و اسکرول کنید',
        'CooperativeGesturesHandler.MacHelpText': 'برای بزرگ‌نمایی، ⌘ را نگه دارید و اسکرول کنید',
        'CooperativeGesturesHandler.MobileHelpText': 'نقشه را با دو انگشت جابه‌جا کنید',
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');

    let styleOk = false;
    map.on('styledata', () => (styleOk = true));
    map.on('error', () => {
      if (!styleOk) {
        styleOk = true;
        setTilesFailed(true);
        map.setStyle(FALLBACK_STYLE);
      }
    });

    const added: maplibregl.Marker[] = [];
    for (const marker of markers) {
      added.push(
        new maplibregl.Marker({ element: placePill(marker.label), anchor: 'bottom', offset: [0, -2] })
          .setLngLat([marker.lng, marker.lat])
          .addTo(map),
      );
    }
    // ملک آخر اضافه می‌شود تا روی بقیه بیفتد
    added.push(
      new maplibregl.Marker({ element: propertyPin() }).setLngLat([lng, lat]).addTo(map),
    );

    return () => {
      for (const m of added) m.remove();
      map.remove();
    };
  }, [lng, lat, markers]);

  return (
    <>
      <div ref={container} className="size-full" />
      {tilesFailed && (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-sm bg-white px-3 py-1.5 text-xs text-muted shadow-xs">
          کاشی‌های نقشه در دسترس نیست؛ فقط موقعیت‌ها نمایش داده می‌شود.
        </div>
      )}
    </>
  );
}
