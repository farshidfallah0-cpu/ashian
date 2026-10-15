/** کلاینت سبک HTTP برای Typesense (بدون وابستگی؛ فقط fetch) */

export class TypesenseError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Typesense ${status}: ${message}`);
    this.name = 'TypesenseError';
  }
}

export interface TypesenseClientOptions {
  url: string;
  apiKey: string;
  /** مهلت هر درخواست؛ جستجو باید خیلی زودتر جواب بدهد */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class TypesenseClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: TypesenseClientOptions) {
    this.base = options.url.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    options: { rawBody?: string; timeoutMs?: number } = {},
  ): Promise<T> {
    const isRaw = options.rawBody !== undefined;
    const response = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: {
        'X-TYPESENSE-API-KEY': this.options.apiKey,
        ...(isRaw
          ? { 'Content-Type': 'text/plain' }
          : body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
      },
      body: isRaw ? options.rawBody : body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? this.timeoutMs),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {
        /* پاسخ JSON نبود */
      }
      throw new TypesenseError(response.status, message);
    }
    // import پاسخ JSONL می‌دهد؛ برای آن متن خام برمی‌گردد
    if (path.includes('/documents/import')) return text as T;
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async health(): Promise<boolean> {
    try {
      const result = await this.request<{ ok: boolean }>('GET', '/health');
      return result.ok === true;
    } catch {
      return false;
    }
  }
}

export const isNotFound = (error: unknown): boolean =>
  error instanceof TypesenseError && error.status === 404;
