import 'server-only';

/** آدرس API برای فراخوانی از سرور Next (داخل شبکه)؛ می‌تواند با آدرس عمومی فرق کند */
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * خواندن داده از API در سرور، با کش ISR.
 * اگر API در دسترس نبود null برمی‌گرداند تا صفحه با بخش‌های خالی هم بالا بیاید،
 * نه اینکه build یا رندر کل صفحه بشکند.
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number };

/**
 * مثل apiGet ولی وضعیت HTTP را نگه می‌دارد: ۴۰۴ واقعی با خرابی API فرق دارد.
 * خطای شبکه و ۵xx پرتاب می‌شود تا ISR نسخه‌ی سالم قبلی را نگه دارد و یک ۴۰۴ اشتباه کش نشود.
 */
export async function apiFetch<T>(
  path: string,
  options: { revalidate: number },
): Promise<ApiResult<T>> {
  const response = await fetch(`${API_URL}${path}`, {
    next: { revalidate: options.revalidate },
    signal: AbortSignal.timeout(8_000),
  });
  if (response.ok) return { ok: true, data: (await response.json()) as T };
  if (response.status >= 500) throw new Error(`API ${path} پاسخ ${response.status} داد`);
  return { ok: false, status: response.status };
}

export async function apiGet<T>(path: string, options: { revalidate: number }): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: options.revalidate },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
