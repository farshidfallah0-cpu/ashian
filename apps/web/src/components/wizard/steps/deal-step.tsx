'use client';

import { LABELS } from '@ashian/shared';
import type { DealType, PropertyType } from '@ashian/shared';
import { Choice, StepHead } from '../ui';
import type { StepProps } from '../types';

const DEALS: Array<{ value: DealType; label: string; sub: string }> = [
  { value: 'rent', label: LABELS.dealType.rent, sub: 'اجاره‌ی سالانه با چک' },
  { value: 'sale', label: LABELS.dealType.sale, sub: 'قیمت کل ملک' },
  { value: 'full_mortgage', label: LABELS.dealType.full_mortgage, sub: 'پرداخت مبلغ رهن' },
  { value: 'short_term', label: LABELS.dealType.short_term, sub: 'قیمت هر شب' },
];

const TYPES: Array<{ value: PropertyType; label: string }> = [
  { value: 'apartment', label: LABELS.propertyType.apartment },
  { value: 'villa', label: LABELS.propertyType.villa },
  { value: 'townhouse', label: LABELS.propertyType.townhouse },
  { value: 'penthouse', label: LABELS.propertyType.penthouse },
  { value: 'duplex', label: LABELS.propertyType.duplex },
  { value: 'hotel_apartment', label: LABELS.propertyType.hotel_apartment },
];

export default function DealStep({ draft, update, showErrors }: StepProps) {
  return (
    <div className="grid gap-10">
      <StepHead
        title="چه آگهی‌ای می‌خواهید ثبت کنید؟"
        lead="نوع معامله و نوع ملک را انتخاب کنید؛ بقیه‌ی فرم بر همین اساس ساده می‌شود."
      />
      <Choice
        legend="نوع معامله"
        options={DEALS}
        value={draft.dealType}
        onChange={(dealType) => update({ dealType })}
        error={showErrors && !draft.dealType ? 'نوع معامله را انتخاب کنید.' : null}
      />
      <Choice
        legend="نوع ملک"
        options={TYPES}
        value={draft.propertyType}
        columns="grid-cols-2 sm:grid-cols-3"
        onChange={(propertyType) => update({ propertyType })}
        error={showErrors && !draft.propertyType ? 'نوع ملک را انتخاب کنید.' : null}
      />
    </div>
  );
}