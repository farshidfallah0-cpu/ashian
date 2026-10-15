'use client';

import { LABELS } from '@ashian/shared';
import type { Furnishing } from '@ashian/shared';
import { useState } from 'react';
import { SQFT_PER_SQM, faNumber, parseNumberInput } from '../../../lib/wizard';
import { Choice, Field, inputClass, Stepper, StepHead, WarningBox } from '../ui';
import type { StepProps } from '../types';

const FURNISHING: Array<{ value: Furnishing; label: string }> = [
  { value: 'furnished', label: LABELS.furnishing.furnished },
  { value: 'semi_furnished', label: LABELS.furnishing.semi_furnished },
  { value: 'unfurnished', label: LABELS.furnishing.unfurnished },
];

type Unit = 'sqft' | 'sqm';

export default function SpecsStep({ draft, update, errors, showErrors, warnings }: StepProps) {
  const [unit, setUnit] = useState<Unit>('sqft');
  const [areaText, setAreaText] = useState(draft.areaSqft ? String(draft.areaSqft) : '');
  const need = (value: unknown, message: string) =>
    showErrors && (value === null || value === '') ? message : null;

  function onArea(raw: string, nextUnit: Unit = unit) {
    setAreaText(raw);
    const n = parseNumberInput(raw);
    update({ areaSqft: n === null ? null : Math.round(nextUnit === 'sqm' ? n * SQFT_PER_SQM : n) });
  }

  function switchUnit(next: Unit) {
    if (next === unit) return;
    setUnit(next);
    // همان مقدار را به واحد جدید نشان بده
    if (draft.areaSqft) {
      setAreaText(String(next === 'sqm' ? Math.round(draft.areaSqft / SQFT_PER_SQM) : draft.areaSqft));
    }
  }

  const areaMessages = warnings.filter((w) => w.field === 'areaSqft' || w.field === 'bedrooms').map((w) => w.message);

  return (
    <div className="grid gap-9">
      <StepHead
        title="مشخصات ملک"
        lead="متراژ را به فوت مربع (استاندارد بازار دبی) یا متر مربع وارد کنید؛ هر دو را برای خریدار نشان می‌دهیم."
      />

      <div className="flex flex-wrap gap-x-10 gap-y-6">
        <Stepper
          label="خواب"
          value={draft.bedrooms}
          min={0}
          max={12}
          format={(n) => (n === 0 ? 'استودیو' : n.toLocaleString('fa-IR'))}
          onChange={(bedrooms) => update({ bedrooms })}
          error={errors.bedrooms ?? need(draft.bedrooms, 'تعداد خواب را مشخص کنید.')}
        />
        <Stepper
          label="حمام"
          value={draft.bathrooms}
          min={1}
          max={14}
          onChange={(bathrooms) => update({ bathrooms })}
          error={errors.bathrooms ?? need(draft.bathrooms, 'تعداد حمام را مشخص کنید.')}
        />
        <Stepper
          label="پارکینگ"
          value={draft.parkingSpaces}
          min={0}
          max={10}
          onChange={(parkingSpaces) => update({ parkingSpaces })}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-4">
          <label htmlFor="area" className="text-sm font-medium text-ink">
            متراژ
          </label>
          <div role="group" aria-label="واحد متراژ" className="flex gap-1 text-sm">
            {(['sqft', 'sqm'] as const).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => switchUnit(u)}
                className={`rounded-sm px-2.5 py-1 transition-colors ${
                  unit === u ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {u === 'sqft' ? 'فوت مربع' : 'متر مربع'}
              </button>
            ))}
          </div>
        </div>
        <input
          id="area"
          value={areaText}
          onChange={(e) => onArea(e.target.value)}
          inputMode="numeric"
          dir="ltr"
          aria-invalid={errors.areaSqft ? true : undefined}
          className={`${inputClass} text-start`}
        />
        {draft.areaSqft ? (
          <p className="mt-1.5 text-sm text-muted">
            {faNumber.format(draft.areaSqft)} فوت مربع ≈ {faNumber.format(draft.areaSqft / SQFT_PER_SQM)} متر مربع
          </p>
        ) : null}
        {(errors.areaSqft ?? need(draft.areaSqft, 'متراژ را وارد کنید.')) && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {errors.areaSqft ?? 'متراژ را وارد کنید.'}
          </p>
        )}
      </div>

      <WarningBox messages={areaMessages} />

      <Choice
        legend="مبلمان"
        options={FURNISHING}
        value={draft.furnishing}
        columns="grid-cols-1 sm:grid-cols-3"
        onChange={(furnishing) => update({ furnishing })}
        error={need(draft.furnishing, 'وضعیت مبلمان را انتخاب کنید.')}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="طبقه (اختیاری)" hint="همکف = ۰" error={errors.floor}>
          {(id) => (
            <input
              id={id}
              value={draft.floor === null ? '' : String(draft.floor)}
              onChange={(e) => update({ floor: parseNumberInput(e.target.value) })}
              inputMode="numeric"
              dir="ltr"
              className={`${inputClass} text-start`}
            />
          )}
        </Field>
        <Field label="سال ساخت (اختیاری)" error={errors.buildYear}>
          {(id) => (
            <input
              id={id}
              value={draft.buildYear === null ? '' : String(draft.buildYear)}
              onChange={(e) => update({ buildYear: parseNumberInput(e.target.value) })}
              inputMode="numeric"
              dir="ltr"
              placeholder="2018"
              className={`${inputClass} text-start`}
            />
          )}
        </Field>
      </div>

      <Field
        label="شماره‌ی مجوز تبلیغ (Permit / Trakheesi)"
        hint="در دبی هر آگهی باید مجوز تبلیغ داشته باشد. آگهی با مجوز اعتماد بیشتری می‌گیرد و رتبه‌اش بهتر می‌شود."
        error={errors.permitNumber}
      >
        {(id) => (
          <input
            id={id}
            value={draft.permitNumber}
            onChange={(e) => update({ permitNumber: e.target.value })}
            dir="ltr"
            maxLength={40}
            className={`${inputClass} text-start`}
          />
        )}
      </Field>
    </div>
  );
}