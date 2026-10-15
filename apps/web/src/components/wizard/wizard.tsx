'use client';

import { buttonClasses } from '@ashian/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { apiRequest, sessionStore } from '../../lib/client-api';
import {
  EMPTY_DRAFT,
  STEPS,
  STEP_OF_FIELD,
  clearLocal,
  draftFromListing,
  faNumber,
  isStepComplete,
  loadLocal,
  saveLocal,
  suggestTitle,
  toPayload,
  type Draft,
  type StepId,
} from '../../lib/wizard';
import type { ListingDetail } from '@ashian/shared';
import type { StepProps, Warning } from './types';

const Loading = () => <div className="skeleton h-64 w-full" aria-hidden />;

/** هر مرحله چانک جدا دارد و فقط وقتی به آن می‌رسید بارگذاری می‌شود */
const STEP_COMPONENTS = {
  deal: dynamic(() => import('./steps/deal-step'), { loading: Loading }),
  location: dynamic(() => import('./steps/location-step'), { loading: Loading }),
  specs: dynamic(() => import('./steps/specs-step'), { loading: Loading }),
  price: dynamic(() => import('./steps/price-step'), { loading: Loading }),
  amenities: dynamic(() => import('./steps/amenities-step'), { loading: Loading }),
  media: dynamic(() => import('./steps/media-step'), { loading: Loading }),
  text: dynamic(() => import('./steps/text-step'), { loading: Loading }),
  review: dynamic(() => import('./steps/review-step'), { loading: Loading }),
} as const;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_MS = 1200;
const VALIDATE_MS = 450;

export function Wizard({ editId }: { editId?: string }) {
  const loggedIn = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.snapshot,
    sessionStore.serverSnapshot,
  );
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<StepId>('deal');
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [status, setStatus] = useState<ListingDetail['status'] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const dirty = useRef(false);
  /** ساخت پیش‌نویس در حال انجام است (دوبار کلیک پشت‌سرهم دو پیش‌نویس نسازد) */
  const creating = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // بارگذاری اولیه: ویرایش از سرور، ثبت جدید از ذخیره‌ی محلی
  useEffect(() => {
    let alive = true;
    (async () => {
      if (editId) {
        const response = await apiRequest(`/v1/listings/${editId}`);
        if (!alive) return;
        if (!response?.ok) {
          setNotice(
            response?.status === 404
              ? 'این آگهی پیدا نشد یا به شما تعلق ندارد.'
              : 'بارگذاری آگهی ناموفق بود؛ دوباره تلاش کنید.',
          );
          return setReady(true);
        }
        const listing = (await response.json()) as ListingDetail;
        if (!listing.isOwner) {
          setNotice('این آگهی به شما تعلق ندارد.');
          return setReady(true);
        }
        setDraft(draftFromListing(listing));
        setStatus(listing.status);
      } else {
        const local = loadLocal();
        if (local && (local.draft.dealType || local.draft.publicId)) {
          setDraft(local.draft);
          setStep(local.step);
          setRestored(true);
        }
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [editId]);

  const update = useCallback((patch: Partial<Draft>) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  // اعتبارسنجی زنده روی سرور (تنها منبع قواعد) + هشدار داده‌ی غیرعادی
  useEffect(() => {
    if (!ready || !dirty.current) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const response = await apiRequest('/v1/listings/validate', {
        method: 'POST',
        body: JSON.stringify(toPayload(draft)),
        signal: controller.signal,
      });
      if (!response?.ok) return;
      const result = (await response.json()) as { errors: Record<string, string>; warnings: Warning[] };
      setErrors(result.errors);
      setWarnings(result.warnings);
    }, VALIDATE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, ready]);

  // ذخیره‌ی خودکار: همیشه محلی؛ بعد از ساخت پیش‌نویس، روی سرور هم (فقط وقتی داده معتبر است)
  useEffect(() => {
    if (!ready || !dirty.current) return;
    if (!editId) saveLocal(draft, step);
    if (!draft.publicId || Object.keys(errors).length > 0) return;
    const timer = setTimeout(async () => {
      setSave('saving');
      const response = await apiRequest(`/v1/listings/${draft.publicId}`, {
        method: 'PATCH',
        body: JSON.stringify(toPayload(draft)),
      });
      setSave(response?.ok ? 'saved' : 'error');
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, step, errors, ready, editId]);

  const index = STEPS.findIndex((s) => s.id === step);

  const stepHasError = (id: StepId) =>
    Object.keys(errors).some((field) => STEP_OF_FIELD[field] === id);

  /** ساخت پیش‌نویس روی سرور (لازم برای آپلود عکس)؛ عنوان موقت از انتخاب‌ها ساخته می‌شود */
  function ensureServerDraft(): Promise<boolean> {
    if (draftRef.current.publicId) return Promise.resolve(true);
    creating.current ??= createServerDraft().finally(() => {
      creating.current = null;
    });
    return creating.current;
  }

  async function createServerDraft(): Promise<boolean> {
    const current = draftRef.current;
    const payload = { ...toPayload(current), title: current.title.trim() || suggestTitle(current) };
    const response = await apiRequest('/v1/listings', { method: 'POST', body: JSON.stringify(payload) });
    if (!response?.ok) {
      let message = 'ساخت پیش‌نویس ناموفق بود؛ دوباره تلاش کنید.';
      try {
        const body = (await response?.json()) as {
          errors?: Array<{ path: string; message: string }>;
          message?: string;
        };
        const first = body.errors?.[0];
        if (first) {
          const target = STEP_OF_FIELD[first.path];
          if (target) setStep(target);
          setErrors((e) => ({ ...e, [first.path]: first.message }));
          setShowErrors(true);
          message = first.message;
        } else if (body.message) message = body.message;
      } catch {
        /* بدنه‌ی JSON نبود */
      }
      setNotice(message);
      return false;
    }
    const created = (await response.json()) as { publicId: string };
    setDraft((d) => ({ ...d, title: d.title || payload.title!, publicId: created.publicId }));
    setStatus('draft');
    return true;
  }

  async function next() {
    setNotice(null);
    const current = STEPS[index]!.id;
    if (!isStepComplete(current, draft) || stepHasError(current)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    const target = STEPS[index + 1];
    if (!target) return;
    if (target.id === 'media' && !(await ensureServerDraft())) return;
    setStep(target.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setShowErrors(false);
    setNotice(null);
    const target = STEPS[index - 1];
    if (target) {
      setStep(target.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goTo(id: StepId) {
    // فقط به مرحله‌های قبلی یا مرحله‌هایی که همه‌ی قبلی‌هایشان کامل است
    const target = STEPS.findIndex((s) => s.id === id);
    const allowed = STEPS.slice(0, target).every((s) => isStepComplete(s.id, draft));
    if (!allowed) return;
    if (STEPS[target]!.id === 'media' || target > STEPS.findIndex((s) => s.id === 'media')) {
      if (!draft.publicId) return;
    }
    setShowErrors(false);
    setStep(id);
  }

  function restart() {
    clearLocal();
    dirty.current = false;
    setDraft(EMPTY_DRAFT);
    setStep('deal');
    setErrors({});
    setWarnings([]);
    setRestored(false);
  }

  if (!loggedIn && !editId && ready) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <h1 className="font-display text-3xl text-ink">برای ثبت آگهی وارد شوید</h1>
        <p className="mt-3 text-base text-ink-2">
          با شماره‌ی موبایل وارد شوید؛ پیش‌نویس آگهی شما در حساب‌تان ذخیره می‌ماند و از هر دستگاه ادامه
          می‌دهید.
        </p>
        <Link
          href="/login?next=/listings/new"
          className={`${buttonClasses({ variant: 'primary', size: 'lg' })} mt-8`}
        >
          ورود با موبایل
        </Link>
      </div>
    );
  }

  if (!ready) return <Loading />;

  if (editId && !draft.publicId) {
    return (
      <div className="py-20 text-center">
        <p className="text-base text-ink-2">{notice ?? 'در حال بارگذاری…'}</p>
        <Link href="/account/listings" className="mt-4 inline-block text-base underline">
          آگهی‌های من
        </Link>
      </div>
    );
  }

  const StepComponent = STEP_COMPONENTS[step];
  const stepProps: StepProps = {
    draft,
    update,
    errors,
    showErrors,
    warnings,
    status,
    editing: !!editId,
    goTo,
  };
  const last = index === STEPS.length - 1;

  return (
    <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
      {/* ناوبری مراحل: دسکتاپ ستون چسبان، موبایل نوار پیشرفت */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="lg:hidden">
          <p className="text-sm text-muted">
            مرحله‌ی {faNumber.format(index + 1)} از {faNumber.format(STEPS.length)}
          </p>
          <p className="font-display text-lg text-ink">{STEPS[index]!.label}</p>
          <div className="mt-3 h-1 rounded-full bg-surface-2" aria-hidden>
            <div
              className="h-full origin-right rounded-full bg-brand transition-transform duration-300 ease-out"
              style={{ width: '100%', transform: `scaleX(${(index + 1) / STEPS.length})` }}
            />
          </div>
        </div>
        <ol className="hidden lg:block" aria-label="مراحل ثبت آگهی">
          {STEPS.map((s, i) => {
            const done = i < index || isStepComplete(s.id, draft);
            const active = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex w-full items-center gap-3 border-s-2 py-2.5 ps-4 text-start text-base transition-colors ${
                    active
                      ? 'border-ink text-ink'
                      : 'border-line text-muted hover:text-ink'
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full font-sans text-xs ${
                      active
                        ? 'bg-brand text-white'
                        : done
                          ? 'bg-verified-soft text-verified'
                          : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {faNumber.format(i + 1)}
                  </span>
                  {s.label}
                  {stepHasError(s.id) && (
                    <span className="ms-auto size-1.5 rounded-full bg-danger" aria-label="خطا" />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <p role="status" aria-live="polite" className="mt-6 hidden text-sm text-muted lg:block">
          {save === 'saving' && 'در حال ذخیره‌ی پیش‌نویس…'}
          {save === 'saved' && <span className="text-verified">پیش‌نویس ذخیره شد</span>}
          {save === 'error' && <span className="text-danger">ذخیره‌ی خودکار ناموفق بود</span>}
          {save === 'idle' && draft.publicId && 'تغییرات خودکار ذخیره می‌شود'}
          {save === 'idle' && !draft.publicId && 'تا مرحله‌ی عکس‌ها روی همین دستگاه ذخیره می‌شود'}
        </p>
      </aside>

      <div className="min-w-0 pb-28 lg:pb-0">
        {restored && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-surface px-4 py-3 text-base text-ink-2">
            پیش‌نویس قبلی شما بازیابی شد.
            <button
              type="button"
              onClick={restart}
              className="text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink"
            >
              شروع از نو
            </button>
          </div>
        )}

        <StepComponent {...stepProps} />

        {notice && (
          <p role="alert" className="mt-6 text-base text-danger">
            {notice}
          </p>
        )}

        {!last && (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 py-3 shadow-sheet lg:static lg:mt-12 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3 lg:max-w-none">
              <button
                type="button"
                onClick={back}
                disabled={index === 0}
                className={`${buttonClasses({ variant: 'secondary', size: 'lg' })} disabled:invisible`}
              >
                قبلی
              </button>
              <button
                type="button"
                onClick={() => void next()}
                className={`${buttonClasses({ variant: 'primary', size: 'lg' })} min-w-40`}
              >
                {step === 'amenities' ? 'ادامه به عکس‌ها' : 'ادامه'}
              </button>
            </div>
          </div>
        )}
        {last && (
          <div className="mt-10">
            <button
              type="button"
              onClick={back}
              className={buttonClasses({ variant: 'secondary', size: 'md' })}
            >
              بازگشت و ویرایش
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
