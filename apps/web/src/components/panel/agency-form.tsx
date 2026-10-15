'use client';

import { buttonClasses, controlClass } from '@ashian/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { apiRequest } from '../../lib/client-api';

export interface AgencyFormValues {
  name: string;
  nameEn: string;
  description: string;
  licenseNumber: string;
}

const label = 'mb-1.5 block text-sm font-medium text-ink';

/** ساخت آژانس (mode=create) و ویرایش مشخصات آن (mode=edit)؛ تغییر شماره‌ی مجوز دوباره باید تأیید شود */
export function AgencyForm({ mode, initial }: { mode: 'create' | 'edit'; initial: AgencyFormValues }) {
  const id = useId();
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [gate, setGate] = useState<'checking' | 'login' | 'exists' | 'ready'>(mode === 'create' ? 'checking' : 'ready');

  useEffect(() => {
    if (mode !== 'create') return;
    let alive = true;
    apiRequest('/v1/agent/me').then(async (r) => {
      if (!alive) return;
      if (!r || r.status === 401) return setGate('login');
      if (r.ok && ((await r.json()) as { managedAgency: unknown }).managedAgency) return setGate('exists');
      setGate('ready');
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    const payload = {
      name: v.name.trim(),
      nameEn: v.nameEn.trim() || null,
      description: v.description.trim(),
      licenseNumber: v.licenseNumber.trim() || null,
    };
    const response = await apiRequest('/v1/agency', {
      method: mode === 'create' ? 'POST' : 'PATCH',
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response?.ok) {
      let text = 'ذخیره نشد؛ دوباره تلاش کنید.';
      try {
        const body = (await response?.json()) as { message?: string; errors?: Array<{ message?: string }> };
        text = body.errors?.[0]?.message ?? body.message ?? text;
      } catch {
        /* بدنه‌ی JSON نبود */
      }
      return setError(text);
    }
    if (mode === 'create') return router.replace('/agency');
    setSaved(true);
    router.refresh();
  }

  if (gate === 'checking') return <div className="skeleton h-56 w-full max-w-xl" aria-hidden />;
  if (gate === 'login')
    return (
      <div className="max-w-xl">
        <p className="text-base text-ink-2">برای ساخت آژانس ابتدا وارد شوید.</p>
        <Link href="/login?next=/agency/new" className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-5`}>
          ورود با موبایل
        </Link>
      </div>
    );
  if (gate === 'exists')
    return (
      <div className="max-w-xl">
        <p className="text-base text-ink-2">شما قبلاً یک آژانس ساخته‌اید.</p>
        <Link href="/agency" className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-5`}>
          پنل آژانس
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} noValidate className="grid max-w-xl gap-6">
      <div>
        <label htmlFor={`${id}-n`} className={label}>
          نام آژانس
        </label>
        <input id={`${id}-n`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={controlClass} />
      </div>
      <div>
        <label htmlFor={`${id}-e`} className={label}>
          نام انگلیسی (اختیاری)
        </label>
        <input id={`${id}-e`} value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} dir="ltr" className={`${controlClass} text-start`} />
      </div>
      <div>
        <label htmlFor={`${id}-d`} className={label}>
          معرفی
        </label>
        <textarea id={`${id}-d`} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={5} maxLength={1500} className={`${controlClass} h-auto py-3 leading-8`} />
      </div>
      <div>
        <label htmlFor={`${id}-l`} className={label}>
          شماره‌ی مجوز شرکت (ORN)
        </label>
        <input id={`${id}-l`} value={v.licenseNumber} onChange={(e) => setV({ ...v, licenseNumber: e.target.value })} dir="ltr" className={`${controlClass} text-start`} />
        <p className="mt-1.5 text-sm text-muted">تا تأیید مجوز توسط تیم آشیان، آژانس در فهرست عمومی نمایش داده نمی‌شود.</p>
      </div>
      {error && (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button type="submit" aria-busy={busy || undefined} className={buttonClasses({ variant: 'primary', size: 'lg' })}>
          {mode === 'create' ? 'ساخت آژانس' : 'ذخیره‌ی تغییرات'}
        </button>
        {saved && <span role="status" className="text-sm text-verified">ذخیره شد</span>}
      </div>
    </form>
  );
}