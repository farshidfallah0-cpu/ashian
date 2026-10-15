'use client';

import { buttonClasses, controlClass } from '@ashian/ui';
import { toEnglishDigits } from '@ashian/shared';
import { CheckCircle, Copy, Phone, WhatsappLogo } from '@phosphor-icons/react/ssr';
import { useId, useState, type FormEvent } from 'react';
import { Modal, apiErrorMessage } from './modal';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const STORAGE_KEY = 'ashian:contact';

export type ContactMode = 'message' | 'visit_request';

export type ContactDialogState =
  | { kind: 'form'; mode: ContactMode }
  | { kind: 'phone'; phone: string }
  | { kind: 'whatsapp'; url: string }
  | { kind: 'error'; status: number };

const DAYS = ['امروز', 'فردا', 'پس‌فردا', 'آخر هفته', 'هر روز که بشود'] as const;
const TIMES = ['صبح', 'ظهر', 'عصر', 'شب', 'هر ساعتی'] as const;

function remembered(): { name: string; phone: string } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      name?: string;
      phone?: string;
    };
    return { name: parsed.name ?? '', phone: parsed.phone ?? '' };
  } catch {
    return { name: '', phone: '' };
  }
}

interface Props {
  state: ContactDialogState;
  publicId: string;
  listingTitle: string;
  listingCode: number;
  agentName: string;
  onClose: () => void;
}

export default function ContactDialog({ state, ...rest }: Props) {
  const { onClose } = rest;
  switch (state.kind) {
    case 'phone':
      return (
        <Modal title="شماره‌ی تماس" onClose={onClose}>
          <PhoneResult phone={state.phone} agentName={rest.agentName} code={rest.listingCode} />
        </Modal>
      );
    case 'whatsapp':
      return (
        <Modal title="گفت‌وگو در واتساپ" onClose={onClose}>
          <p className="text-base text-ink-2">
            مرورگر باز شدن خودکار واتساپ را مسدود کرد. با دکمه‌ی زیر گفت‌وگو را شروع کنید.
          </p>
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-5 w-full`}
          >
            <WhatsappLogo size={20} aria-hidden />
            باز کردن واتساپ
          </a>
        </Modal>
      );
    case 'error':
      return (
        <Modal title="انجام نشد" onClose={onClose}>
          <p className="text-base text-ink-2">
            {state.status === 404
              ? 'این آگهی دیگر فعال نیست.'
              : state.status === 429
                ? 'تعداد درخواست‌ها زیاد است؛ چند لحظه بعد دوباره تلاش کنید.'
                : 'ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.'}
          </p>
        </Modal>
      );
    case 'form':
      return (
        <Modal
          title={state.mode === 'visit_request' ? 'درخواست بازدید' : 'پیام به آگهی‌دهنده'}
          onClose={onClose}
        >
          <ContactForm initialMode={state.mode} {...rest} />
        </Modal>
      );
  }
}

function PhoneResult({
  phone,
  agentName,
  code,
}: {
  phone: string;
  agentName: string;
  code: number;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-sm text-muted">
        {agentName} · هنگام تماس بگویید آگهی با کد {code.toLocaleString('fa-IR', { useGrouping: false })}{' '}
        را در آشیان دیده‌اید.
      </p>
      <p dir="ltr" className="mt-4 text-center font-sans text-3xl font-bold tracking-wide text-ink">
        {phone}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <a href={`tel:${phone}`} className={buttonClasses({ variant: 'primary', size: 'lg' })}>
          <Phone size={18} aria-hidden />
          تماس
        </a>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(phone)
              .then(() => setCopied(true))
              .catch(() => undefined);
          }}
          className={buttonClasses({ variant: 'secondary', size: 'lg' })}
        >
          {copied ? <CheckCircle size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          {copied ? 'کپی شد' : 'کپی شماره'}
        </button>
      </div>
    </div>
  );
}

function ContactForm({
  initialMode,
  publicId,
  listingTitle,
  listingCode,
  agentName,
  onClose,
}: Omit<Props, 'state'> & { initialMode: ContactMode }) {
  const id = useId();
  const [mode, setMode] = useState<ContactMode>(initialMode);
  const [saved] = useState(remembered);
  const [name, setName] = useState(saved.name);
  const [phone, setPhone] = useState(saved.phone);
  const [message, setMessage] = useState(
    `سلام، آگهی «${listingTitle}» (کد ${listingCode.toLocaleString('fa-IR', { useGrouping: false })}) را در آشیان دیدم. هنوز موجود است؟`,
  );
  const [day, setDay] = useState<string>(DAYS[1]);
  const [time, setTime] = useState<string>(TIMES[2]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('نام خود را وارد کنید.');
    if (toEnglishDigits(phone).replace(/\D/g, '').length < 8)
      return setError('شماره‌ی موبایل را کامل وارد کنید (با پیش‌شماره‌ی کشور یا صفر اول).');

    const text =
      mode === 'visit_request'
        ? `درخواست بازدید: ${day}، ${time}.${note.trim() ? `\n${note.trim()}` : ''}`
        : message.trim();
    if (mode === 'message' && text.length < 5) return setError('پیام خیلی کوتاه است.');

    setSending(true);
    const response = await fetch(`${API}/v1/listings/${publicId}/leads`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: mode, name: name.trim(), phone, message: text }),
    }).catch(() => null);
    setSending(false);

    if (!response?.ok) return setError(await apiErrorMessage(response));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: name.trim(), phone }));
    } catch {
      /* حالت خصوصی مرورگر */
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="py-2 text-center">
        <CheckCircle size={44} weight="light" className="mx-auto text-verified" aria-hidden />
        <p className="mt-4 font-display text-lg text-ink">درخواست شما ارسال شد</p>
        <p className="mt-2 text-base text-muted">
          {agentName} از طریق شماره‌ی شما با شما تماس می‌گیرد.
        </p>
        <button
          type="button"
          onClick={onClose}
          className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-6 w-full`}
        >
          بستن
        </button>
      </div>
    );
  }

  const label = 'mb-1.5 block text-sm font-medium text-ink';
  return (
    <form onSubmit={submit} noValidate>
      <div role="tablist" aria-label="نوع درخواست" className="mb-5 flex gap-6 border-b border-line">
        {(
          [
            ['message', 'پیام'],
            ['visit_request', 'درخواست بازدید'],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`-mb-px border-b-2 pb-2.5 text-base transition-colors ${
              mode === value ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        <div>
          <label htmlFor={`${id}-name`} className={label}>
            نام شما
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
            placeholder="+971 50 123 4567"
            className={`${controlClass} text-start`}
          />
        </div>

        {mode === 'message' ? (
          <div>
            <label htmlFor={`${id}-message`} className={label}>
              پیام
            </label>
            <textarea
              id={`${id}-message`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
              className={`${controlClass} h-auto py-3 leading-7`}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${id}-day`} className={label}>
                  روز
                </label>
                <select
                  id={`${id}-day`}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={controlClass}
                >
                  {DAYS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-time`} className={label}>
                  ساعت
                </label>
                <select
                  id={`${id}-time`}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={controlClass}
                >
                  {TIMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-note`} className={label}>
                توضیح (اختیاری)
              </label>
              <textarea
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={400}
                className={`${controlClass} h-auto py-3 leading-7`}
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        aria-busy={sending || undefined}
        className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-6 w-full`}
      >
        {sending ? 'در حال ارسال…' : mode === 'visit_request' ? 'ارسال درخواست بازدید' : 'ارسال پیام'}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        شماره‌ی شما فقط برای {agentName} ارسال می‌شود و عمومی نمی‌شود.
      </p>
    </form>
  );
}
