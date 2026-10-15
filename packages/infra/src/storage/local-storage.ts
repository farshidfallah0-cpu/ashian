import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  assertSafeKey,
  type ObjectStorage,
  type PresignedUpload,
  type PresignOptions,
} from './types.js';

export interface LocalUploadClaims {
  key: string;
  contentType: string;
  maxBytes: number;
  /** زمان انقضا (میلی‌ثانیه‌ی epoch) */
  exp: number;
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createLocalUploadToken(claims: LocalUploadClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

/** توکن آپلود محلی را بررسی می‌کند؛ اگر نامعتبر یا منقضی باشد null */
export function verifyLocalUploadToken(
  token: string,
  secret: string,
  now = Date.now(),
): LocalUploadClaims | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as LocalUploadClaims;
    if (claims.exp < now) return null;
    assertSafeKey(claims.key);
    return claims;
  } catch {
    return null;
  }
}

/** ذخیره‌ی فایل روی دیسک محلی برای حالت lite. API فایل‌ها را زیر /media سرو می‌کند. */
export class LocalStorage implements ObjectStorage {
  readonly kind = 'local' as const;
  private readonly root: string;

  constructor(
    root: string,
    private readonly apiUrl: string,
    private readonly secret: string,
  ) {
    this.root = resolve(root);
  }

  private pathOf(key: string) {
    assertSafeKey(key);
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error(`کلید خارج از مسیر مجاز: ${key}`);
    return full;
  }

  // contentType برای دیسک محلی لازم نیست؛ API نوع را از پسوند فایل می‌سازد
  async put(key: string, body: Uint8Array, _contentType?: string): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  publicUrl(key: string): string {
    assertSafeKey(key);
    return `${this.apiUrl}/media/${key}`;
  }

  async presignUpload(key: string, options: PresignOptions): Promise<PresignedUpload> {
    assertSafeKey(key);
    const exp = Date.now() + (options.expiresInSeconds ?? 600) * 1000;
    const token = createLocalUploadToken(
      { key, contentType: options.contentType, maxBytes: options.maxBytes, exp },
      this.secret,
    );
    return {
      method: 'PUT',
      url: `${this.apiUrl}/v1/media/local-upload/${token}`,
      headers: { 'content-type': options.contentType },
      expiresAt: new Date(exp).toISOString(),
    };
  }

  async ping(): Promise<boolean> {
    try {
      await mkdir(this.root, { recursive: true });
      return (await stat(this.root)).isDirectory();
    } catch {
      return false;
    }
  }
}
