'use client';

import { buttonClasses } from '@ashian/ui';
import dynamic from 'next/dynamic';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ContactDialogState, ContactMode } from './contact-dialog';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ContactAction = 'call' | 'whatsapp' | ContactMode;

/** فرم و نتیجه‌ی تماس فقط بعد از اولین کلیک بارگذاری می‌شود (JavaScript اولیه سبک می‌ماند) */
const ContactDialog = dynamic(() => import('./contact-dialog'), { ssr: false });

interface ContactContext {
  start: (action: ContactAction) => void;
  busy: ContactAction | null;
}

const Ctx = createContext<ContactContext | null>(null);

function useContact(): ContactContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('دکمه‌ی تماس باید داخل ContactRoot باشد');
  return ctx;
}

/** پارامتر ?contact= از URL (کارت‌های نتایج به آگهی لینک می‌دهند)؛ در SSR همیشه null */
const noopSubscribe = () => () => undefined;
const readContactParam = () => new URLSearchParams(window.location.search).get('contact');
const serverContactParam = () => null;

interface LeadResult {
  phone?: string;
  whatsappUrl?: string;
}

/**
 * وضعیت مشترک همه‌ی دکمه‌های تماس صفحه (کارت کنار صفحه و نوار پایین موبایل).
 * تماس و واتساپ همان لحظه یک lead ثبت می‌کنند و فقط در پاسخ همان درخواست شماره می‌دهند؛
 * پیام و درخواست بازدید فرم باز می‌کنند. لینک «?contact=» کارت‌های نتایج را هم اینجا پردازش می‌کنیم.
 */
export function ContactRoot({
  publicId,
  title,
  code,
  agentName,
  children,
}: {
  publicId: string;
  title: string;
  code: number;
  agentName: string;
  children: ReactNode;
}) {
  const [openedDialog, setDialog] = useState<ContactDialogState | null>(null);
  const [busy, setBusy] = useState<ContactAction | null>(null);
  const wanted = useSyncExternalStore(noopSubscribe, readContactParam, serverContactParam);
  const [dismissed, setDismissed] = useState(false);
  // ?contact=message فرم را خودکار باز می‌کند (تا وقتی کاربر آن را نبسته)
  const dialog: ContactDialogState | null =
    openedDialog ?? (wanted === 'message' && !dismissed ? { kind: 'form', mode: 'message' } : null);
  const flight = useRef(false);

  const start = useCallback(
    async (action: ContactAction) => {
      if (action === 'message' || action === 'visit_request') {
        setDialog({ kind: 'form', mode: action });
        return;
      }
      if (flight.current) return;
      flight.current = true;
      setBusy(action);
      try {
        const response = await fetch(`${API}/v1/listings/${publicId}/leads`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: action }),
        }).catch(() => null);

        if (!response?.ok) {
          setDialog({ kind: 'error', status: response?.status ?? 0 });
          return;
        }
        const result = (await response.json()) as LeadResult;

        if (action === 'call' && result.phone) {
          // روی موبایل مستقیم شماره‌گیر؛ روی دسکتاپ شماره را نشان می‌دهیم
          if (window.matchMedia('(pointer: coarse)').matches) {
            window.location.href = `tel:${result.phone}`;
            return;
          }
          setDialog({ kind: 'phone', phone: result.phone });
        } else if (action === 'whatsapp' && result.whatsappUrl) {
          const opened = window.open(result.whatsappUrl, '_blank', 'noopener');
          if (!opened) setDialog({ kind: 'whatsapp', url: result.whatsappUrl });
        }
      } finally {
        flight.current = false;
        setBusy(null);
      }
    },
    [publicId],
  );

  // ?contact=call|whatsapp دکمه‌ی مربوط را چند لحظه برجسته می‌کند (فقط DOM، بدون state)
  useEffect(() => {
    if (wanted !== 'call' && wanted !== 'whatsapp') return;
    const targets = document.querySelectorAll<HTMLElement>(`[data-contact="${wanted}"]`);
    targets.forEach((el) => el.setAttribute('data-flash', 'true'));
    const timer = setTimeout(() => targets.forEach((el) => el.removeAttribute('data-flash')), 2400);
    return () => clearTimeout(timer);
  }, [wanted]);
  const value = useMemo(() => ({ start, busy }), [start, busy]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialog && (
        <ContactDialog
          state={dialog}
          publicId={publicId}
          listingTitle={title}
          listingCode={code}
          agentName={agentName}
          onClose={() => {
            setDialog(null);
            setDismissed(true);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

const STYLE = {
  primary: buttonClasses({ variant: 'primary', size: 'lg' }),
  secondary: buttonClasses({ variant: 'secondary', size: 'lg' }),
  text: buttonClasses({ variant: 'text', size: 'md' }),
  // نوار پایین موبایل: دکمه‌های کوتاه‌تر
  barPrimary: buttonClasses({ variant: 'primary', size: 'md' }),
  barSecondary: buttonClasses({ variant: 'secondary', size: 'md' }),
} as const;

export function ContactButton({
  action,
  style,
  icon,
  children,
  className = '',
}: {
  action: ContactAction;
  style: keyof typeof STYLE;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { start, busy } = useContact();
  return (
    <button
      type="button"
      data-contact={action}
      aria-busy={busy === action || undefined}
      disabled={busy !== null && busy !== action}
      onClick={() => void start(action)}
      className={`${STYLE[style]} data-[flash=true]:outline data-[flash=true]:outline-2 data-[flash=true]:outline-offset-4 data-[flash=true]:outline-accent ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
