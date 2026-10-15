'use client';

import { LABELS, formatNumber, formatPrice } from '@ashian/shared';
import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/client-api';
import { clearLocal, faNumber, type StepId } from '../../../lib/wizard';
import { PromoteCard } from '../promote-card';
import { StepHead } from '../ui';
import type { StepProps, Warning } from '../types';

interface Review {
  warnings: Warning[];
  duplicates: Array<{ publicId: string; title: string; reason: 'photos' | 'details' }>;
  photos: { ready: number; processing: number; failed: number };
}

const MIN_PHOTOS = 3;

function Row({ label, value, step, goTo }: { label: string; value: string; step: StepId; goTo: StepProps['goTo'] }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
      <dt className="text-base text-muted">{label}</dt>
      <dd className="flex items-baseline gap-4 text-base text-ink">
        {value}
        <button type="button" onClick={() => goTo(step)} className="text-sm text-ink-2 underline decoration-line-strong underline-offset-[6px] hover:decoration-ink">
          ویرایش
        </button>
      </dd>
    </div>
  );
}

export default function ReviewStep({ draft, status, goTo, editing }: StepProps) {
  const publicId = draft.publicId!;
  const [review, setReview] = useState<Review | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [liveStatus, setLiveStatus] = useState(status);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      apiRequest(`/v1/listings/${publicId}/review`),
      apiRequest(`/v1/listings/${publicId}`),
    ]);
    if (r?.ok) setReview((await r.json()) as Review);
    if (d?.ok) {
      const detail = (await d.json()) as { status: string; rejectionReason?: string | null };
      setLiveStatus(detail.status as typeof status);
      setRejection(detail.rejectionReason ?? null);
    }
  }, [publicId]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // تا عکس‌ها پردازش می‌شوند خودکار بررسی تازه شود
  useEffect(() => {
    if (!review || review.photos.processing === 0) return;
    const timer = setTimeout(() => void load(), 2000);
    return () => clearTimeout(timer);
  }, [review, load]);

  const needsConfirm = !!review && (review.warnings.length > 0 || review.duplicates.length > 0);
  const photosOk = !!review && review.photos.ready >= MIN_PHOTOS;
  const titleOk = draft.title.trim().length >= 8;
  const canSubmit = photosOk && titleOk && review!.photos.processing === 0 && (!needsConfirm || confirmed);
  const submittable = liveStatus === 'draft' || liveStatus === 'rejected';

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await apiRequest(`/v1/listings/${publicId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ confirm: confirmed }),
    });
    setBusy(false);
    if (response?.ok) {
      clearLocal();
      setSubmitted(true);
      setLiveStatus('pending_review');
      return;
    }
    let message = 'ارسال ناموفق بود؛ دوباره تلاش کنید.';
    try {
      message = ((await response?.json()) as { message?: string }).message ?? message;
    } catch {
      /* بدنه‌ی JSON نبود */
    }
    setError(message);
    void load();
  }

  if (submitted || liveStatus === 'pending_review' || liveStatus === 'active') {
    return (
      <div className="grid gap-8">
        <StepHead
          title={submitted ? 'آگهی برای بررسی ارسال شد' : liveStatus === 'active' ? 'تغییرات ذخیره شد' : 'آگهی در انتظار تأیید است'}
          lead={
            liveStatus === 'active'
              ? 'آگهی فعال است و تغییرات همین الان اعمال شد.'
              : 'تیم آشیان آگهی را بررسی می‌کند. بعد از تأیید در جستجو دیده می‌شود و از «آگهی‌های من» پیگیری می‌کنید.'
          }
        />
        <div className="flex flex-wrap gap-3">
          <Link href="/account/listings" className={buttonClasses({ variant: 'dark', size: 'lg' })}>
            آگهی‌های من
          </Link>
          {liveStatus === 'active' && (
            <Link href={`/listings/${publicId}`} className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
              مشاهده‌ی آگهی
            </Link>
          )}
        </div>
        <PromoteCard publicId={publicId} />
      </div>
    );
  }

  return (
    <div className="grid gap-9">
      <StepHead title="پیش‌نمایش و ارسال" lead="همه‌چیز را یک بار مرور کنید. بعد از ارسال، آگهی در وضعیت «در انتظار تأیید» می‌ماند." />

      {rejection && (
        <p role="status" className="rounded-sm bg-danger-soft px-4 py-3 text-base text-danger">
          دلیل رد قبلی: {rejection}
        </p>
      )}

      <dl>
        <Row label="نوع آگهی" value={`${draft.dealType ? LABELS.dealType[draft.dealType] : ''} · ${draft.propertyType ? LABELS.propertyType[draft.propertyType] : ''}`} step="deal" goTo={goTo} />
        <Row label="موقعیت" value={draft.placeLabel} step="location" goTo={goTo} />
        <Row
          label="مشخصات"
          value={`${draft.bedrooms === 0 ? 'استودیو' : `${faNumber.format(draft.bedrooms ?? 0)} خواب`} · ${faNumber.format(draft.bathrooms ?? 0)} حمام · ${faNumber.format(draft.areaSqft ?? 0)} فوت`}
          step="specs"
          goTo={goTo}
        />
        <Row label="قیمت" value={draft.price ? formatPrice(draft.price) : '—'} step="price" goTo={goTo} />
        <Row label="امکانات" value={`${faNumber.format(draft.amenityIds.length)} مورد`} step="amenities" goTo={goTo} />
        <Row label="عنوان" value={draft.title} step="text" goTo={goTo} />
      </dl>

      <ul className="grid gap-2 text-base">
        <li className={photosOk ? 'text-verified' : 'text-danger'}>
          {photosOk ? '✓' : '✗'} عکس‌ها: {formatNumber(review?.photos.ready ?? 0, 0)} آماده
          {review && review.photos.processing > 0 && ` (${formatNumber(review.photos.processing, 0)} در حال پردازش)`}
          {!photosOk && ` — حداقل ${faNumber.format(MIN_PHOTOS)} عکس لازم است`}
          {!photosOk && (
            <button type="button" onClick={() => goTo('media')} className="ms-3 text-sm text-ink underline">
              افزودن عکس
            </button>
          )}
        </li>
        <li className={titleOk ? 'text-verified' : 'text-danger'}>{titleOk ? '✓' : '✗'} عنوان آگهی</li>
        <li className={draft.permitNumber ? 'text-verified' : 'text-muted'}>
          {draft.permitNumber ? '✓' : '○'} شماره‌ی مجوز تبلیغ {draft.permitNumber ? '' : '(ثبت نشده؛ اختیاری ولی توصیه می‌شود)'}
        </li>
      </ul>

      {review && needsConfirm && (
        <section className="rounded-sm border border-accent/40 bg-accent-soft p-5" aria-label="هشدارها">
          <h2 className="font-display text-lg text-ink">پیش از ارسال بررسی کنید</h2>
          {review.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 ps-5 text-base text-ink-2">
              {review.warnings.map((w) => (
                <li key={w.code}>{w.message}</li>
              ))}
            </ul>
          )}
          {review.duplicates.length > 0 && (
            <div className="mt-4">
              <p className="text-base text-ink">
                آگهی‌های فعال زیر شبیه این آگهی‌اند ({'عکس یا مشخصات مشابه'}):
              </p>
              <ul className="mt-2 space-y-1 text-base">
                {review.duplicates.map((d) => (
                  <li key={d.publicId}>
                    <Link href={`/listings/${d.publicId}`} target="_blank" className="underline">
                      {d.title}
                    </Link>
                    <span className="text-sm text-muted">
                      {' · '}
                      {d.reason === 'photos' ? 'عکس مشابه' : 'مشخصات مشابه'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="mt-5 flex cursor-pointer items-start gap-3 text-base text-ink">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1.5 size-4 accent-brand" />
            موارد بالا را دیده‌ام و اطلاعات آگهی درست است. (در غیر این صورت به مرحله‌ی مربوط برگردید و اصلاح کنید.)
          </label>
        </section>
      )}

      {error && (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      )}

      {submittable ? (
        <div>
          <button
            type="button"
            disabled={!canSubmit}
            aria-busy={busy || undefined}
            onClick={() => void submit()}
            className={`${buttonClasses({ variant: 'primary', size: 'lg' })} min-w-56`}
          >
            ارسال برای بررسی
          </button>
          {editing && <p className="mt-2 text-sm text-muted">تغییرات شما پیش‌تر خودکار ذخیره شده است.</p>}
        </div>
      ) : null}
    </div>
  );
}