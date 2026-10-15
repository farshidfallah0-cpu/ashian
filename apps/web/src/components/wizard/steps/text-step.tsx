'use client';

import { suggestTitle, faNumber } from '../../../lib/wizard';
import { Field, inputClass, StepHead } from '../ui';
import type { StepProps } from '../types';

const MIN_GOOD = 150;

export default function TextStep({ draft, update, errors, showErrors }: StepProps) {
  const suggestion = suggestTitle(draft);
  const length = draft.description.trim().length;
  const titleError =
    errors.title ?? (showErrors && draft.title.trim().length < 8 ? 'عنوان باید دست‌کم ۸ نویسه باشد.' : null);

  return (
    <div className="grid gap-8">
      <StepHead
        title="عنوان و توضیحات"
        lead="عنوان کوتاه و دقیق بنویسید و در توضیحات از ویژگی‌های واقعی ملک بگویید. اطلاعات تماس را داخل متن نگذارید؛ مشاوران از دکمه‌های آگهی تماس می‌گیرند."
      />

      <Field label="عنوان آگهی" error={titleError}>
        {(id) => (
          <>
            <input
              id={id}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={120}
              aria-invalid={titleError ? true : undefined}
              className={`${inputClass} h-12 text-lg`}
            />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
              <span>{faNumber.format(draft.title.length)} / ۱۲۰</span>
              {suggestion && suggestion !== draft.title && (
                <button
                  type="button"
                  onClick={() => update({ title: suggestion })}
                  className="text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
                >
                  پیشنهاد: «{suggestion}»
                </button>
              )}
            </div>
          </>
        )}
      </Field>

      <Field label="توضیحات (اختیاری، ولی توصیه می‌شود)" error={errors.description}>
        {(id) => (
          <>
            <textarea
              id={id}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={9}
              maxLength={5000}
              className={`${inputClass} h-auto py-3 leading-8`}
            />
            <p className="mt-1.5 text-sm text-muted" aria-live="polite">
              {faNumber.format(length)} نویسه
              {length < MIN_GOOD
                ? ` · توضیحات حداقل ${faNumber.format(MIN_GOOD)} نویسه‌ای امتیاز کیفیت و رتبه‌ی بهتری می‌گیرد`
                : ' · عالی'}
            </p>
          </>
        )}
      </Field>
    </div>
  );
}