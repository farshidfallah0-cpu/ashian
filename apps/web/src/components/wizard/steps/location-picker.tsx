'use client';

import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#EFEDE8' } }],
};

/** انتخاب نقطه‌ی ملک: سنجاق قابل کشیدن + کلیک روی نقشه. نقشه فقط یک بار ساخته می‌شود. */
export default function LocationPicker({
  lng,
  lat,
  onChange,
}: {
  lng: number;
  lat: number;
  onChange: (lng: number, lat: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onChangeRef = useRef(onChange);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: 15,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
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

    const pin = document.createElement('div');
    pin.className =
      'flex size-10 cursor-grab items-center justify-center rounded-full border-[3px] border-white bg-accent shadow-pop active:cursor-grabbing';
    pin.innerHTML = '<span class="size-2.5 rounded-full bg-white"></span>';
    const marker = new maplibregl.Marker({ element: pin, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);
    markerRef.current = marker;
    marker.on('dragend', () => {
      const p = marker.getLngLat();
      onChangeRef.current(Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6)));
    });
    map.on('click', (event) => {
      marker.setLngLat(event.lngLat);
      onChangeRef.current(Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6)));
    });

    return () => {
      marker.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
    // نقشه فقط یک بار ساخته می‌شود؛ تغییر مکان از بیرون در effect بعدی اعمال می‌شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // انتخاب محله/برج دیگر: سنجاق و نقشه به نقطه‌ی جدید می‌روند (نه وقتی کاربر خودش کشیده)
  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const current = marker.getLngLat();
    if (Math.abs(current.lng - lng) > 1e-6 || Math.abs(current.lat - lat) > 1e-6) {
      marker.setLngLat([lng, lat]);
      map.easeTo({ center: [lng, lat], duration: 350 });
    }
  }, [lng, lat]);

  return (
    <div className="relative h-80 overflow-hidden rounded-sm bg-surface-2 md:h-96">
      <div ref={container} className="size-full" />
      {tilesFailed && (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-sm bg-white px-3 py-1.5 text-xs text-muted shadow-xs">
          کاشی‌های نقشه در دسترس نیست؛ سنجاق همچنان قابل جابه‌جایی است.
        </div>
      )}
    </div>
  );
}