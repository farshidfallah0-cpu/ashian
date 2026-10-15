/**
 * فراخوانی API از مرورگر با کوکی نشست. توکن دسترسی ۱۵ دقیقه عمر دارد؛ اگر ۴۰۱ برگشت،
 * یک بار با کوکی نوسازی (چرخشی) نشست را تازه می‌کنیم و درخواست را تکرار می‌کنیم.
 * شکست شبکه `null` برمی‌گرداند تا فراخواننده بدون try/catch بتواند پیام بدهد.
 * (بدون import از @ashian/* تا در JavaScript اولیه‌ی هیچ صفحه‌ای وزن اضافه نکند.)
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** نوسازی هم‌زمان چند درخواست ۴۰۱ فقط یک بار انجام شود */
let refreshing: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response | null> {
  const run = () =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  try {
    const first = await run();
    if (first.status !== 401) return first;
    return (await refreshSession()) ? await run() : first;
  } catch {
    return null;
  }
}

/** نشانگر «وارد شده‌ام» (کوکی غیر httpOnly که API هنگام ورود می‌گذارد) */
export const SESSION_HINT = 'ashian_session=1';

export const sessionStore = {
  subscribe(callback: () => void) {
    window.addEventListener('ashian:session', callback);
    window.addEventListener('focus', callback);
    return () => {
      window.removeEventListener('ashian:session', callback);
      window.removeEventListener('focus', callback);
    };
  },
  snapshot: () => document.cookie.split('; ').includes(SESSION_HINT),
  serverSnapshot: () => false,
};

/** مسیر داخلی امن برای بازگشت بعد از ورود (جلوگیری از open redirect) */
export function safeNext(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return fallback;
  }
  return value;
}
