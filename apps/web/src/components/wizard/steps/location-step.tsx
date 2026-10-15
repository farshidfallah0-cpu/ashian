'use client';

import dynamic from 'next/dynamic';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../../lib/client-api';
import { inputClass, StepHead } from '../ui';
import type { StepProps } from '../types';

const LocationPicker = dynamic(() => import('./location-picker'), {
  ssr: false,
  loading: () => <div className="skeleton h-80 w-full" aria-hidden />,
});

interface Place {
  id: string;
  parentId: string | null;
  type: 'emirate' | 'community' | 'tower';
  nameFa: string;
  nameEn: string;
  aliases: string[];
  lng: number | null;
  lat: number | null;
  listingCount: number;
}

/** یکسان‌سازی ساده برای جستجو: حروف عربی، فاصله و حروف بزرگ */
const fold = (value: string) =>
  value
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\s\u200c\-_]/g, '');

export default function LocationStep({ draft, update, errors, showErrors }: StepProps) {
  const listId = useId();
  const [places, setPlaces] = useState<Place[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(draft.placeLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    apiRequest('/v1/locations').then(async (response) => {
      if (!alive) return;
      if (!response?.ok) return setFailed(true);
      setPlaces((await response.json()) as Place[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const label = (p: Place) =>
    p.type === 'tower' && p.parentId
      ? `${p.nameFa}، ${byId.get(p.parentId)?.nameFa ?? ''}`
      : p.nameFa;

  const matches = useMemo(() => {
    const q = fold(query);
    const candidates = places.filter((p) => p.type !== 'emirate');
    const list = !q
      ? candidates.filter((p) => p.type === 'community')
      : candidates.filter((p) =>
          [p.nameFa, p.nameEn, ...p.aliases].some((name) => fold(name).includes(q)),
        );
    // محله‌های پرآگهی و محله‌ها قبل از برج‌ها
    return list
      .sort((a, b) => Number(b.type === 'community') - Number(a.type === 'community') || b.listingCount - a.listingCount)
      .slice(0, 8);
  }, [places, query]);

  function choose(place: Place) {
    update({
      locationId: place.id,
      placeLabel: label(place),
      lng: place.lng,
      lat: place.lat,
    });
    setQuery(label(place));
    setOpen(false);
  }

  const chosen = draft.locationId ? byId.get(draft.locationId) : null;
  const error =
    errors.locationId ?? (showErrors && !draft.locationId ? 'محله یا برج را انتخاب کنید.' : null);
  const mapError = errors.lng ?? errors.lat;

  return (
    <div className="grid gap-8">
      <StepHead
        title="ملک کجاست؟"
        lead="نام محله یا برج را جستجو کنید، بعد سنجاق را روی ساختمان بگذارید."
      />

      <div ref={box} className="relative">
        <label htmlFor={`${listId}-q`} className="mb-1.5 block text-sm font-medium text-ink">
          محله یا برج
        </label>
        <input
          id={`${listId}-q`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          value={query}
          placeholder="مثلاً مارینا، JVC، برج خلیفه…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(matches.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && open && matches[active]) {
              e.preventDefault();
              choose(matches[active]!);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          className={inputClass}
        />
        {open && matches.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-line bg-bg py-1 shadow-pop"
          >
            {matches.map((place, i) => (
              <li
                key={place.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(place);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 text-base ${
                  i === active ? 'bg-surface' : ''
                }`}
              >
                <span className="text-ink">{label(place)}</span>
                <span className="shrink-0 text-xs text-muted">
                  {place.type === 'tower' ? 'برج / مجتمع' : 'محله'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {open && query && matches.length === 0 && places.length > 0 && (
          <p className="mt-2 text-sm text-muted">موردی پیدا نشد؛ املای دیگری را امتحان کنید.</p>
        )}
        {failed && <p className="mt-2 text-sm text-danger">فهرست مکان‌ها بارگذاری نشد؛ صفحه را تازه کنید.</p>}
        {error && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
        {chosen?.type === 'community' && (
          <p className="mt-2 text-sm text-muted">
            اگر ملک داخل یک برج یا مجتمع مشخص است، همان را انتخاب کنید تا آگهی دقیق‌تر پیدا شود.
          </p>
        )}
      </div>

      {draft.locationId && draft.lng !== null && draft.lat !== null && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink">موقعیت دقیق روی نقشه</p>
          <LocationPicker
            lng={draft.lng}
            lat={draft.lat}
            onChange={(lng, lat) => update({ lng, lat })}
          />
          <p className="mt-2 text-sm text-muted">
            سنجاق را بکشید یا روی نقشه بزنید. مشاوران و خریداران همین نقطه را می‌بینند.
          </p>
          {mapError && (
            <p role="alert" className="mt-1.5 text-sm text-danger">
              {mapError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}