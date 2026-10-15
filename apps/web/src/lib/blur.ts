import 'server-only';
import { crc32, deflateSync } from 'node:zlib';

/**
 * blurhash → تصویر PNG بسیار کوچک (data URI) در سرور.
 * مرورگر آن را با پس‌زمینه‌ی cover نرم می‌کند، پس تا رسیدن عکس اصلی جای خالی دیده نمی‌شود
 * و هیچ کتابخانه‌ای به bundle کلاینت اضافه نمی‌شود.
 */

const ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

function decode83(text: string): number {
  let value = 0;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('blurhash نامعتبر');
    value = value * 83 + index;
  }
  return value;
}

const srgbToLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055) * 255);
};
const signPow = (v: number, exp: number) => Math.sign(v) * Math.abs(v) ** exp;

function decodePixels(hash: string, width: number, height: number): Uint8Array {
  const sizeFlag = decode83(hash[0]!);
  const numY = Math.floor(sizeFlag / 9) + 1;
  const numX = (sizeFlag % 9) + 1;
  const maxValue = (decode83(hash[1]!) + 1) / 166;

  const colors: Array<[number, number, number]> = [];
  for (let i = 0; i < numX * numY; i++) {
    if (i === 0) {
      const v = decode83(hash.slice(2, 6));
      colors.push([srgbToLinear(v >> 16), srgbToLinear((v >> 8) & 255), srgbToLinear(v & 255)]);
    } else {
      const v = decode83(hash.slice(4 + i * 2, 6 + i * 2));
      const q = [Math.floor(v / 361), Math.floor(v / 19) % 19, v % 19];
      colors.push(q.map((x) => signPow((x - 9) / 9, 2) * maxValue) as [number, number, number]);
    }
  }

  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < numY; j++) {
        for (let i = 0; i < numX; i++) {
          const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
          const c = colors[j * numX + i]!;
          r += c[0] * basis;
          g += c[1] * basis;
          b += c[2] * basis;
        }
      }
      const o = (y * width + x) * 3;
      pixels[o] = linearToSrgb(r);
      pixels[o + 1] = linearToSrgb(g);
      pixels[o + 2] = linearToSrgb(b);
    }
  }
  return pixels;
}

function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // عمق بیت
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const cache = new Map<string, string>();

/** data URI برای پس‌زمینه‌ی جای‌نگهدار؛ برای blurhash خراب undefined برمی‌گرداند */
export function blurDataUrl(blurhash: string | null | undefined): string | undefined {
  if (!blurhash) return undefined;
  const hit = cache.get(blurhash);
  if (hit) return hit;
  try {
    const width = 12;
    const height = 9;
    const png = encodePng(decodePixels(blurhash, width, height), width, height);
    const url = `data:image/png;base64,${png.toString('base64')}`;
    if (cache.size > 2_000) cache.clear();
    cache.set(blurhash, url);
    return url;
  } catch {
    return undefined;
  }
}
