'use client';

import { LABELS, REPORT_REASONS, type ReportReason } from '@ashian/shared';
import { buttonClasses, controlClass } from '@ashian/ui';
import { CheckCircle } from '@phosphor-icons/react/ssr';
import { useId, useState, type FormEvent } from 'react';
import { Modal, apiErrorMessage } from './modal';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ReportDialog({
  publicId,
  onClose,
}: {
  publicId: string;
  onClose: () => void;
}) {
  const id = useId();
  const [reason, setReason] = useState<ReportReason>('wrong_info');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (reason === 'other' && details.trim().length < 5) {
      return setError('لطفاً توضیح کوتاهی بنویسید.');
    }
    setSending(true);
    const response = await fetch(`${API}/v1/listings/${publicId}/report`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details: details.trim() || undefined }),
    }).catch(() => null);
    setSending(false);
    if (!response?.ok) return setError(await apiErrorMessage(response));
    setDone(true);
  }

  return (
    <Modal title="گزارش آگهی" onClose={onClose}>
      {done ? (
        <div className="py-2 text-center">
          <CheckCircle size={44} weight="light" className="mx-auto text-verified" aria-hidden />
          <p className="mt-4 font-display text-lg text-ink">گزارش شما ثبت شد</p>
          <p className="mt-2 text-base text-muted">
            تیم آشیان آگهی را بررسی می‌کند. از کمک شما برای قابل‌اعتماد ماندن آگهی‌ها سپاسگزاریم.
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-6 w-full`}
          >
            بستن
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">مشکل آگهی چیست؟</legend>
            <div className="grid gap-1">
              {REPORT_REASONS.map((value) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-base text-ink-2 hover:bg-surface"
                >
                  <input
                    type="radio"
                    name={`${id}-reason`}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="size-4 accent-brand"
                  />
                  {LABELS.reportReason[value]}
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor={`${id}-details`} className="mb-1.5 mt-4 block text-sm font-medium text-ink">
            توضیح {reason === 'other' ? '' : '(اختیاری)'}
          </label>
          <textarea
            id={`${id}-details`}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            maxLength={1000}
            className={`${controlClass} h-auto py-3 leading-7`}
          />

          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            aria-busy={sending || undefined}
            className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-5 w-full`}
          >
            {sending ? 'در حال ارسال…' : 'ثبت گزارش'}
          </button>
        </form>
      )}
    </Modal>
  );
}
