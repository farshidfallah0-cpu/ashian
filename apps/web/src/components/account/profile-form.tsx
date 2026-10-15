'use client';

import type { AccountUser } from '@ashian/shared';
import { buttonClasses, controlClass } from '@ashian/ui';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { apiRequest } from '../../lib/client-api';

export function ProfileForm({ user }: { user: AccountUser }) {
  const id = useId();
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const response = await apiRequest('/v1/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ name, email }),
    });
    setBusy(false);
    if (response?.ok) return setMessage({ ok: true, text: 'تغییرات ذخیره شد.' });
    let text = 'ذخیره نشد؛ دوباره تلاش کنید.';
    try {
      const body = (await response?.json()) as { errors?: Array<{ message?: string }> };
      text = body.errors?.[0]?.message ?? text;
    } catch {
      /* بدنه‌ی JSON نبود */
    }
    setMessage({ ok: false, text });
  }

  const label = 'mb-1.5 block text-sm font-medium text-ink';
  return (
    <form onSubmit={submit} noValidate className="grid max-w-md gap-5">
      <div>
        <label htmlFor={`${id}-name`} className={label}>
          نام
        </label>
        <input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={controlClass}
        />
      </div>
      <div>
        <label htmlFor={`${id}-email`} className={label}>
          ایمیل (برای هشدار آگهی)
        </label>
        <input
          id={`${id}-email`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          dir="ltr"
          autoComplete="email"
          className={`${controlClass} text-start`}
        />
      </div>
      <div>
        <p className={label}>شماره‌ی موبایل</p>
        <p dir="ltr" className="text-start font-sans text-base text-ink-2">
          +{user.phone}
        </p>
        <p className="mt-1 text-sm text-muted">شماره‌ی ورود قابل تغییر نیست.</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          aria-busy={busy || undefined}
          className={buttonClasses({ variant: 'dark', size: 'md' })}
        >
          ذخیره‌ی تغییرات
        </button>
        {message && (
          <p role="status" className={`text-sm ${message.ok ? 'text-verified' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      onClick={async () => {
        setBusy(true);
        await apiRequest('/v1/auth/logout', { method: 'POST' });
        window.dispatchEvent(new Event('ashian:session'));
        router.replace('/');
        router.refresh();
      }}
      className={buttonClasses({ variant: 'secondary', size: 'md' })}
    >
      خروج از حساب
    </button>
  );
}