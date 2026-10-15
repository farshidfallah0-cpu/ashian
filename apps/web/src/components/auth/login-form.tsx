'use client';

import { buttonClasses, controlClass } from '@ashian/ui';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { API_BASE } from '../../lib/client-api';

const OTP_LENGTH = 5;

/** ارقام فارسی و عربی → انگلیسی (برای شمارش طول کد؛ سرور هر سه را می‌پذیرد) */
const toLatin = (value: string) =>
  value.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) =>
    String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)),
  );

interface OtpResponse {
  retryAfterSeconds?: number;
  devCode?: string;
}

async function errorText(response: Response | null): Promise<string> {
  if (!response) return 'ارتباط با سرور برقرار نشد؛ اینترنت را بررسی و دوباره تلاش کنید.';
  if (response.status === 429) return 'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.';
  try {
    const body = (await response.json()) as {
      message?: unknown;
      errors?: Array<{ message?: string }>;
    };
    const first = body.errors?.find((e) => typeof e.message === 'string')?.message;
    if (first) return first;
    if (typeof body.message === 'string') return body.message;
  } catch {
    /* بدنه‌ی JSON نبود */
  }
  return 'درخواست انجام نشد؛ دوباره تلاش کنید.';
}

/**
 * ورود یا ثبت‌نام با موبایل و کد یکبارمصرف (دو مرحله). هم داخل Modal (مسیر رهگیری‌شده) و هم
 * در صفحه‌ی کامل /login استفاده می‌شود. نشست با کوکی httpOnly است و این کد هیچ توکنی نمی‌بیند.
 */
export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const id = useId();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // شمارش معکوس ارسال مجدد
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  async function requestCode(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    if (toLatin(phone).replace(/\D/g, '').length < 8) {
      setError('شماره‌ی موبایل را کامل وارد کنید (با +971 یا +98 یا صفر اول).');
      return;
    }
    setBusy(true);
    const response = await fetch(`${API_BASE}/v1/auth/otp/request`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      // کد قبلاً فرستاده شده و فقط باید صبر کرد: به مرحله‌ی کد برو
      if (response?.status === 429 && step === 'phone') {
        setStep('code');
        setWait(60);
      }
      setError(await errorText(response));
      return;
    }
    const data = (await response.json()) as OtpResponse;
    setDevCode(data.devCode ?? null);
    setWait(data.retryAfterSeconds ?? 60);
    setCode('');
    setStep('code');
  }

  async function verify(value: string) {
    setError(null);
    setBusy(true);
    const response = await fetch(`${API_BASE}/v1/auth/otp/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: value }),
    }).catch(() => null);
    if (!response?.ok) {
      setBusy(false);
      setCode('');
      setError(await errorText(response));
      codeInput.current?.focus();
      return;
    }
    window.dispatchEvent(new Event('ashian:session'));
    onSuccess();
  }

  function onCodeChange(raw: string) {
    const digits = toLatin(raw).replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    if (digits.length === OTP_LENGTH && !busy) void verify(digits);
  }

  const label = 'mb-1.5 block text-sm font-medium text-ink';

  if (step === 'phone') {
    return (
      <form onSubmit={requestCode} noValidate>
        <label htmlFor={`${id}-phone`} className={label}>
          شماره‌ی موبایل
        </label>
        <input
          id={`${id}-phone`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          autoFocus
          placeholder="+971 50 123 4567"
          aria-invalid={error ? true : undefined}
          className={`${controlClass} h-12 text-start text-lg`}
        />
        <p className="mt-2 text-sm text-muted">
          شماره‌های امارات (+۹۷۱) و ایران (+۹۸) پذیرفته می‌شود. کد تأیید پیامک می‌شود.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          aria-busy={busy || undefined}
          className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-6 w-full`}
        >
          {busy ? 'در حال ارسال…' : 'دریافت کد تأیید'}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === OTP_LENGTH) void verify(code);
      }}
      noValidate
    >
      <p className="text-base text-ink-2">
        کد {OTP_LENGTH.toLocaleString('fa-IR')} رقمی به{' '}
        <span dir="ltr" className="font-sans text-ink">
          {phone}
        </span>{' '}
        ارسال شد.{' '}
        <button
          type="button"
          onClick={() => {
            setStep('phone');
            setError(null);
          }}
          className="text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
        >
          ویرایش شماره
        </button>
      </p>

      <label htmlFor={`${id}-code`} className={`${label} mt-5`}>
        کد تأیید
      </label>
      <input
        id={`${id}-code`}
        ref={codeInput}
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        dir="ltr"
        maxLength={OTP_LENGTH + 2}
        aria-invalid={error ? true : undefined}
        className={`${controlClass} h-14 text-center font-sans text-2xl tracking-[0.6em]`}
      />

      {devCode && (
        <p className="mt-3 rounded-sm bg-accent-soft px-3 py-2 text-sm text-accent-active">
          حالت توسعه: کد آزمایشی{' '}
          <button
            type="button"
            onClick={() => onCodeChange(devCode)}
            className="font-sans font-bold underline"
          >
            {devCode}
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={code.length !== OTP_LENGTH}
        aria-busy={busy || undefined}
        className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-6 w-full`}
      >
        {busy ? 'در حال ورود…' : 'ورود'}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        {wait > 0 ? (
          <>ارسال مجدد کد تا {wait.toLocaleString('fa-IR')} ثانیه‌ی دیگر</>
        ) : (
          <button
            type="button"
            onClick={() => void requestCode()}
            className="text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
          >
            ارسال مجدد کد
          </button>
        )}
      </p>
    </form>
  );
}
