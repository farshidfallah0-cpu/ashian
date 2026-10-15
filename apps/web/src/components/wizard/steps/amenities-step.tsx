'use client';

import { LABELS } from '@ashian/shared';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/client-api';
import { StepHead } from '../ui';
import type { StepProps } from '../types';

interface Amenity {
  id: number;
  slug: string;
  nameFa: string;
  category: 'building' | 'unit' | 'view' | 'policy';
}

const ORDER = ['building', 'unit', 'view', 'policy'] as const;

export default function AmenitiesStep({ draft, update }: StepProps) {
  const [amenities, setAmenities] = useState<Amenity[] | null>(null);

  useEffect(() => {
    let alive = true;
    apiRequest('/v1/amenities').then(async (response) => {
      if (alive && response?.ok) setAmenities((await response.json()) as Amenity[]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: number) =>
    update({
      amenityIds: draft.amenityIds.includes(id)
        ? draft.amenityIds.filter((a) => a !== id)
        : [...draft.amenityIds, id],
    });

  return (
    <div className="grid gap-9">
      <StepHead
        title="امکانات"
        lead="هر چه دقیق‌تر، فیلترهای جستجو آگهی شما را بهتر پیدا می‌کنند. این مرحله اختیاری است."
      />
      {!amenities && <div className="skeleton h-48 w-full" aria-hidden />}
      {amenities &&
        ORDER.map((category) => {
          const items = amenities.filter((a) => a.category === category);
          if (items.length === 0) return null;
          return (
            <fieldset key={category}>
              <legend className="mb-3 font-sans text-base font-bold text-ink">
                {LABELS.amenityCategory[category]}
              </legend>
              <div className="flex flex-wrap gap-2">
                {items.map((a) => {
                  const on = draft.amenityIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex h-10 cursor-pointer items-center rounded-sm border px-3.5 text-base transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                        on ? 'border-ink bg-surface text-ink' : 'border-line-strong text-ink-2 hover:border-ink'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(a.id)}
                        className="sr-only"
                      />
                      {a.nameFa}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
    </div>
  );
}