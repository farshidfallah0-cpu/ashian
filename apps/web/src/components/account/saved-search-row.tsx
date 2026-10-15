'use client';

import { ALERT_CHANNELS, ALERT_FREQUENCIES, LABELS, type SavedSearchDto } from '@ashian/shared';
import { controlClass } from '@ashian/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { apiRequest } from '../../lib/client-api';

/**
 * تنظیم هشدار یک جستجوی ذخیره‌شده: تناوب (فوری، روزانه، هفتگی، بدون هشدار) و کانال‌ها
 * (اعلان در سایت، ایمیل، پیامک). هر تغییر همان لحظه ذخیره می‌شود.
 */
export function AlertSettings({
  search,
  hasEmail,
}: {
  search: SavedSearchDto;
  hasEmail: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [frequency, setFrequency] = useState(search.frequency);
  const [channels, setChannels] = useState(search.channels);
  const [status, setStatus] = useState('');

  async function save(patch: { frequency?: typeof frequency; channels?: typeof channels }) {
    setStatus('در حال ذخیره…');
    const response = await apiRequest(`/v1/saved-searches/${search.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setStatus(response?.ok ? 'ذخیره شد' : 'ذخیره نشد؛ دوباره تلاش کنید');
    if (response?.ok) setTimeout(() => setStatus(''), 1800);
  }

  async function remove() {
    if (!window.confirm(`جستجوی «${search.name}» حذف شود؟`)) return;
    const response = await apiRequest(`/v1/saved-searches/${search.id}`, { method: 'DELETE' });
    if (response?.ok) router.refresh();
  }

  const toggle = (channel: (typeof ALERT_CHANNELS)[number]) => {
    const next = channels.includes(channel)
      ? channels.filter((c) => c !== channel)
      : [...channels, channel];
    if (next.length === 0) return; // حداقل یک کانال
    setChannels(next);
    void save({ channels: next });
  };

  return (
    <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
      <div>
        <label htmlFor={`${id}-freq`} className="mb-1.5 block text-sm text-muted">
          هشدار آگهی تازه
        </label>
        <select
          id={`${id}-freq`}
          value={frequency}
          onChange={(e) => {
            const next = e.target.value as typeof frequency;
            setFrequency(next);
            void save({ frequency: next });
          }}
          className={`${controlClass} h-10`}
        >
          {ALERT_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {LABELS.alertFrequency[f]}
            </option>
          ))}
        </select>
      </div>

      <fieldset disabled={frequency === 'none'} className="disabled:opacity-40">
        <legend className="mb-1.5 text-sm text-muted">ارسال از طریق</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {ALERT_CHANNELS.map((channel) => (
            <label key={channel} className="flex cursor-pointer items-center gap-2 text-base text-ink-2">
              <input
                type="checkbox"
                checked={channels.includes(channel)}
                onChange={() => toggle(channel)}
                className="size-4 accent-brand"
              />
              {LABELS.alertChannel[channel]}
              {channel === 'email' && !hasEmail && channels.includes('email') && (
                <span className="text-xs text-danger">(ایمیل ثبت نشده)</span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-4 sm:justify-end">
        <span role="status" aria-live="polite" className="text-sm text-verified">
          {status}
        </span>
        <button
          type="button"
          onClick={() => void remove()}
          className="text-sm text-danger underline decoration-danger/30 underline-offset-[6px] hover:decoration-danger"
        >
          حذف
        </button>
      </div>
    </div>
  );
}