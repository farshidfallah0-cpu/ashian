'use client';

import { buttonClasses, controlClass } from '@ashian/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { apiRequest } from '../../lib/client-api';
import { LANGUAGES } from '../../lib/languages';

export interface AgentFormValues {
  brn: string;
  bio: string;
  languages: string[];
  areaIds: string[];
  whatsapp: string;
}

interface Option {
  id: string;
  label: string;
}

/** پیام خطای API (اولین خطای فیلد یا پیام کلی) */
async function errorOf(response: Response | null): Promise<string> {
  if (!response) return 'ارتباط با سرور برقرار نشد.';
  try {
    const body = (await response.json()) as { message?: string; errors?: Array<{ message?: string }> };
    return body.errors?.[0]?.message ?? body.message ?? 'ذخیره نشد؛ دوباره تلاش کنید.';
  } catch {
    return 'ذخیره نشد؛ دوباره تلاش کنید.';
  }
}

const label = 'mb-1.5 block text-sm font-medium text-ink';

/**
 * فرم ثبت‌نام و ویرایش پروفایل مشاور. `mode=join`: ثبت‌نام (مجوز BRN بعداً توسط تیم آشیان تأیید می‌شود).
 * محله‌ها و آژانس‌ها از سرور می‌آیند؛ اعتبارسنجی نهایی همیشه سمت API است.
 */
export function AgentForm({
  mode,
  initial,
  communities,
  agencies = [],
}: {
  mode: 'join' | 'edit';
  initial: AgentFormValues;
  communities: Option[];
  agencies?: Array<{ slug: string; label: string }>;
}) {
  const id = useId();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [agencySlug, setAgencySlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<'checking' | 'login' | 'already' | 'ready'>(
    mode === 'join' ? 'checking' : 'ready',
  );

  // ثبت‌نام: ورود لازم است و کسی که قبلاً مشاور است دوباره ثبت‌نام نمی‌کند
  useEffect(() => {
    if (mode !== 'join') return;
    let alive = true;
    apiRequest('/v1/agent/me').then(async (r) => {
      if (!alive) return;
      if (!r || r.status === 401) return setState('login');
      if (r.ok && ((await r.json()) as { agent: unknown }).agent) return setState('already');
      setState('ready');
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  const toggle = (key: 'languages' | 'areaIds', value: string) =>
    setValues((v) => ({
      ...v,
      [key]: v[key].includes(value) ? v[key].filter((x) => x !== value) : [...v[key], value],
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (values.languages.length === 0) return setError('حداقل یک زبان انتخاب کنید.');
    setBusy(true);
    const payload = {
      brn: values.brn.trim(),
      bio: values.bio.trim(),
      languages: values.languages,
      areaIds: values.areaIds,
      whatsapp: values.whatsapp.trim() || null,
      ...(mode === 'join' && agencySlug ? { agencySlug } : {}),
    };
    const response = await apiRequest(mode === 'join' ? '/v1/agent/join' : '/v1/agent/profile', {
      method: mode === 'join' ? 'POST' : 'PATCH',
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response?.ok) return setError(await errorOf(response));
    if (mode === 'join') return router.replace('/agent');
    setSaved(true);
    router.refresh();
  }

  if (state === 'checking') return <div className="skeleton h-64 w-full max-w-xl" aria-hidden />;
  if (state === 'login') {
    return (
      <div className="max-w-xl">
        <p className="text-base text-ink-2">برای ثبت‌نام به‌عنوان مشاور ابتدا با موبایل وارد شوید.</p>
        <Link href="/login?next=/agents/join" className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-5`}>
          ورود با موبایل
        </Link>
      </div>
    );
  }
  if (state === 'already') {
    return (
      <div className="max-w-xl">
        <p className="text-base text-ink-2">شما قبلاً به‌عنوان مشاور ثبت‌نام کرده‌اید.</p>
        <Link href="/agent" className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-5`}>
          رفتن به پنل مشاور
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-xl gap-7">
      <div>
        <label htmlFor={`${id}-brn`} className={label}>
          شماره‌ی کارت مشاور (BRN)
        </label>
        <input
          id={`${id}-brn`}
          value={values.brn}
          onChange={(e) => setValues({ ...values, brn: e.target.value })}
          inputMode="numeric"
          dir="ltr"
          className={`${controlClass} text-start`}
        />
        <p className="mt-1.5 text-sm text-muted">
          شماره‌ی کارت RERA شما. بعد از ثبت، تیم آشیان آن را بررسی می‌کند؛ تا آن موقع پروفایل شما در فهرست عمومی نیست.
        </p>
      </div>

      <div>
        <label htmlFor={`${id}-bio`} className={label}>
          معرفی کوتاه (اختیاری)
        </label>
        <textarea
          id={`${id}-bio`}
          value={values.bio}
          onChange={(e) => setValues({ ...values, bio: e.target.value })}
          rows={5}
          maxLength={1200}
          className={`${controlClass} h-auto py-3 leading-8`}
        />
      </div>

      <fieldset>
        <legend className={label}>زبان‌هایی که صحبت می‌کنید</legend>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => {
            const on = values.languages.includes(l.code);
            return (
              <label
                key={l.code}
                className={`flex h-10 cursor-pointer items-center rounded-sm border px-3.5 text-base transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                  on ? 'border-ink bg-surface text-ink' : 'border-line-strong text-ink-2 hover:border-ink'
                }`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle('languages', l.code)} className="sr-only" />
                {l.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>محله‌های فعالیت (حداکثر ۱۲)</legend>
        <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
          {communities.map((c) => {
            const on = values.areaIds.includes(c.id);
            return (
              <label
                key={c.id}
                className={`flex h-9 cursor-pointer items-center rounded-sm border px-3 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                  on ? 'border-ink bg-surface text-ink' : 'border-line-strong text-ink-2 hover:border-ink'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && values.areaIds.length >= 12}
                  onChange={() => toggle('areaIds', c.id)}
                  className="sr-only"
                />
                {c.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-wa`} className={label}>
          شماره‌ی واتساپ (اختیاری)
        </label>
        <input
          id={`${id}-wa`}
          value={values.whatsapp}
          onChange={(e) => setValues({ ...values, whatsapp: e.target.value })}
          type="tel"
          dir="ltr"
          placeholder="+971 50 123 4567"
          className={`${controlClass} text-start`}
        />
        <p className="mt-1.5 text-sm text-muted">اگر خالی بماند، همان شماره‌ی ورود شما برای واتساپ استفاده می‌شود.</p>
      </div>

      {mode === 'join' && agencies.length > 0 && (
        <div>
          <label htmlFor={`${id}-ag`} className={label}>
            آژانس (اختیاری)
          </label>
          <select id={`${id}-ag`} value={agencySlug} onChange={(e) => setAgencySlug(e.target.value)} className={controlClass}>
            <option value="">مستقل هستم</option>
            {agencies.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-muted">به مدیر آژانس اعلان می‌رود و او شما را به تیم اضافه می‌کند.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button type="submit" aria-busy={busy || undefined} className={buttonClasses({ variant: 'primary', size: 'lg' })}>
          {mode === 'join' ? 'ثبت‌نام مشاور' : 'ذخیره‌ی تغییرات'}
        </button>
        {saved && <span role="status" className="text-sm text-verified">ذخیره شد</span>}
      </div>
    </form>
  );
}