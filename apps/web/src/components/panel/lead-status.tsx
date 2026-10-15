'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { apiRequest } from '../../lib/client-api';

const STATUSES = [
  ['new', 'جدید'],
  ['contacted', 'تماس گرفته شد'],
  ['viewing', 'بازدید هماهنگ شد'],
  ['closed', 'بسته شد'],
] as const;

/** تغییر وضعیت سرنخ؛ اولین خروج از «جدید» زمان پاسخ را برای میانگین زمان پاسخ ثبت می‌کند */
export function LeadStatus({ leadId, status }: { leadId: string; status: string }) {
  const id = useId();
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [note, setNote] = useState('');

  async function change(next: string) {
    const previous = value;
    setValue(next);
    const response = await apiRequest(`/v1/agent/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    if (response?.ok) {
      setNote('');
      router.refresh();
    } else {
      setValue(previous);
      setNote('ثبت نشد');
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        وضعیت سرنخ
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => void change(e.target.value)}
        className={`h-9 rounded-sm border bg-bg px-2.5 text-sm focus-visible:outline-none ${
          value === 'new' ? 'border-accent text-accent-active' : 'border-line-strong text-ink'
        }`}
      >
        {STATUSES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {note && <span role="alert" className="text-xs text-danger">{note}</span>}
    </div>
  );
}