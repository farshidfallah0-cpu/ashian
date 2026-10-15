import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalUploadToken, LocalStorage, verifyLocalUploadToken } from './local-storage.js';
import { assertSafeKey } from './types.js';

const SECRET = 'x'.repeat(32);

describe('assertSafeKey', () => {
  it.each(['listings/ab12/photo-1.avif', 'a.jpg'])('«%s» مجاز است', (key) => {
    expect(() => assertSafeKey(key)).not.toThrow();
  });

  it.each(['../etc/passwd', '/abs', 'a//b', 'Upper.jpg', 'a\\b', ''])('«%s» رد می‌شود', (key) => {
    expect(() => assertSafeKey(key)).toThrow();
  });
});

describe('upload token', () => {
  const claims = { key: 'tmp/a.jpg', contentType: 'image/jpeg', maxBytes: 1000, exp: 2_000 };

  it('توکن معتبر را می‌پذیرد', () => {
    const token = createLocalUploadToken(claims, SECRET);
    expect(verifyLocalUploadToken(token, SECRET, 1_000)).toEqual(claims);
  });

  it('توکن منقضی را رد می‌کند', () => {
    const token = createLocalUploadToken(claims, SECRET);
    expect(verifyLocalUploadToken(token, SECRET, 3_000)).toBeNull();
  });

  it('توکن دست‌کاری‌شده را رد می‌کند', () => {
    const token = createLocalUploadToken(claims, SECRET);
    const forged = createLocalUploadToken({ ...claims, maxBytes: 10 ** 9 }, SECRET).split('.')[0];
    expect(verifyLocalUploadToken(`${forged}.${token.split('.')[1]}`, SECRET, 1_000)).toBeNull();
    expect(verifyLocalUploadToken(token, 'y'.repeat(32), 1_000)).toBeNull();
  });
});

describe('LocalStorage', () => {
  it('ذخیره، خواندن و حذف', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ashian-'));
    const storage = new LocalStorage(dir, 'http://api', SECRET);
    await storage.put('listings/x/a.txt', new TextEncoder().encode('سلام'), 'text/plain');
    expect((await storage.get('listings/x/a.txt'))?.toString()).toBe('سلام');
    expect(storage.publicUrl('listings/x/a.txt')).toBe('http://api/media/listings/x/a.txt');
    await storage.delete('listings/x/a.txt');
    expect(await storage.get('listings/x/a.txt')).toBeNull();
  });

  it('آدرس آپلود امضاشده می‌سازد', async () => {
    const storage = new LocalStorage(tmpdir(), 'http://api', SECRET);
    const upload = await storage.presignUpload('tmp/u.jpg', {
      contentType: 'image/jpeg',
      maxBytes: 5_000_000,
    });
    expect(upload.method).toBe('PUT');
    const token = upload.url.split('/').pop()!;
    expect(verifyLocalUploadToken(token, SECRET)?.key).toBe('tmp/u.jpg');
  });
});
