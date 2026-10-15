'use client';

import { buttonClasses, controlClass } from '@ashian/ui';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { apiRequest } from '../../lib/client-api';

/** افزودن مشاور به تیم با شماره‌ی موبایل (مشاور باید قبلاً ثبت‌نام کرده باشد) */
export function AddMember() {
  const id = useId();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await apiRequest('/v1/agency/team', { method: 'POST', body: JSON.stringify({ phone }) });
    setBusy(false);
    if (response?.ok) {
      setPhone('');
      setMessage({ ok: true, text: 'مشاور به تیم اضافه شد.' });
      return router.refresh();
    }
    let text = 'افزودن انجام نشد.';
    try {
      const body = (await response?.json()) as { message?: string; errors?: Array<{ message?: string }> };
      text = body.errors?.[0]?.message ?? body.message ?? text;
    } catch {
      /* بدنه‌ی JSON نبود */
    }
    setMessage({ ok: false, text });
  }

  return (
    <form onSubmit={submit} className="max-w-md">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        افزودن مشاور با شماره‌ی موبایل
      </label>
      <div className="flex gap-3">
        <input
          id={id}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          dir="ltr"
          placeholder="+971 50 123 4567"
          className={`${controlClass} text-start`}
        />
        <button type="submit" aria-busy={busy || undefined} className={`${buttonClasses({ variant: 'dark', size: 'md' })} shrink-0`}>
          افزودن
        </button>
      </div>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-verified' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

export function RemoveMember({ agentId, name }: { agentId: string; name: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!window.confirm(`«${name}» از تیم حذف شود؟`)) return;
        const response = await apiRequest(`/v1/agency/team/${agentId}`, { method: 'DELETE' });
        if (response?.ok) router.refresh();
      }}
      className="text-sm text-danger underline decoration-danger/30 underline-offset-[6px] hover:decoration-danger"
    >
      حذف
    </button>
  );
}