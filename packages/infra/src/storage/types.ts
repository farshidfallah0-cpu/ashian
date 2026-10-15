export type PresignedUpload =
  | {
      method: 'PUT';
      url: string;
      headers: Record<string, string>;
      expiresAt: string;
    }
  | {
      /** فرم multipart: fields به ترتیب و سپس فیلد file ارسال شود */
      method: 'POST';
      url: string;
      fields: Record<string, string>;
      expiresAt: string;
    };

export interface PresignOptions {
  contentType: string;
  maxBytes: number;
  expiresInSeconds?: number;
}

export interface ObjectStorage {
  readonly kind: 'local' | 's3';
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
  /** آپلود مستقیم از مرورگر، بدون عبور فایل از API */
  presignUpload(key: string, options: PresignOptions): Promise<PresignedUpload>;
  ping(): Promise<boolean>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,255}$/;

/** جلوگیری از path traversal و کلیدهای عجیب */
export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`کلید فایل نامعتبر: ${key}`);
  }
}
