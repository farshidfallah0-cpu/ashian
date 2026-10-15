/**
 * تست سرتاسری (smoke) روی API و worker در حال اجرا:
 *   pnpm dev   (در یک ترمینال)   و   pnpm --filter @ashian/api smoke
 * ورود با OTP، ساخت آگهی، آپلود عکس، پردازش در worker، علاقه‌مندی، دسترسی‌ها و کارایی.
 */
import { deflateSync, crc32 } from 'node:zlib';
import { and, createDb, eq, isNull, schema } from '@ashian/db';
import { loadRootEnv } from '@ashian/shared/env';

loadRootEnv();
const API = process.env.API_URL ?? 'http://localhost:4000';
const results = [];
let failed = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok });
  if (!ok) failed++;
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail ? `  →  ${detail}` : ''}`);
}

/** کلاینت با cookie jar ساده؛ کوکی refresh فقط به مسیر /v1/auth ارسال می‌شود */
function client() {
  const jar = new Map();
  return {
    jar,
    async call(method, path, { body, headers = {}, raw } = {}) {
      const cookie = [...jar]
        .filter(([name]) => name !== 'ashian_rt' || path.startsWith('/v1/auth'))
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
      const res = await fetch(API + path, {
        method,
        headers: {
          ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers,
        },
        body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
        redirect: 'manual',
      });
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        if (/max-age=0|expires=thu, 01 jan 1970/i.test(line) || value === '') jar.delete(name);
        else jar.set(name, value);
      }
      const type = res.headers.get('content-type') ?? '';
      const data = type.includes('json')
        ? await res.json().catch(() => null)
        : type.startsWith('image/')
          ? Buffer.from(await res.arrayBuffer())
          : await res.text();
      return { status: res.status, data, headers: res.headers };
    },
  };
}

/** PNG واقعی بدون وابستگی (گرادیان ۸۰۰×۶۰۰) */
function makePng(width = 800, height = 600) {
  const row = Buffer.alloc(1 + width * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) {
    const off = y * row.length;
    raw[off] = 0;
    for (let x = 0; x < width; x++) {
      raw[off + 1 + x * 3] = (x * 255) / width;
      raw[off + 2 + x * 3] = (y * 255) / height;
      raw[off + 3 + x * 3] = 120;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function login(phone) {
  const c = client();
  const req = await c.call('POST', '/v1/auth/otp/request', { body: { phone } });
  if (req.status !== 200 || !req.data.devCode)
    throw new Error(`درخواست OTP ناموفق: ${req.status} ${JSON.stringify(req.data)}`);
  const ver = await c.call('POST', '/v1/auth/otp/verify', {
    body: { phone, code: req.data.devCode },
  });
  if (ver.status !== 200) throw new Error(`تأیید OTP ناموفق: ${ver.status}`);
  return { c, user: ver.data.user, requestRes: req };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs = 60_000, every = 700) {
  const t = Date.now();
  while (Date.now() - t < timeoutMs) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}

const db = createDb({
  url: process.env.DATABASE_URL,
  poolMax: 2,
});
const { listings, locations, amenities, listingViews } = schema;

try {
  console.log('\n— سلامت و داده‌ی عمومی');
  const ready = await client().call('GET', '/health/ready');
  check(
    'health/ready سالم است',
    ready.status === 200 && ready.data.status === 'ok',
    JSON.stringify(ready.data),
  );

  const anon = client();
  const comms = await anon.call('GET', '/v1/locations?type=community');
  check(
    'محله‌ها: ≥ ۲۰ مورد با تعداد آگهی',
    comms.status === 200 &&
      comms.data.length >= 20 &&
      comms.data.every((l) => typeof l.listingCount === 'number'),
  );
  const marina = await anon.call('GET', '/v1/locations/dubai-marina');
  check(
    'محله با slug و مختصات',
    marina.status === 200 &&
      marina.data.nameFa === 'دبی مارینا' &&
      marina.data.listingCount > 0 &&
      Math.abs(marina.data.lat - 25.08) < 0.05,
  );
  const tower = await anon.call('GET', '/v1/locations/dubai-marina/marina-gate-1');
  check('برج داخل محله', tower.status === 200 && tower.data.type === 'tower');
  check('محله‌ی ناموجود ۴۰۴', (await anon.call('GET', '/v1/locations/nowhere')).status === 404);
  const tree = await anon.call('GET', '/v1/locations/tree');
  check(
    'درخت مکان‌ها (امارت ← محله ← برج)',
    tree.status === 200 && tree.data[0]?.type === 'emirate' && tree.data[0].children.length >= 20,
  );
  check(
    'Cache-Control عمومی روی مکان‌ها',
    /max-age/.test(comms.headers.get('cache-control') ?? ''),
  );

  const agentsRes = await anon.call('GET', '/v1/agents?pageSize=10');
  const a = agentsRes.data.items;
  check(
    'مشاوران: برتر اول، بدون شماره‌ی تماس',
    agentsRes.status === 200 &&
      a.length > 0 &&
      a[0].isTopAgent &&
      !JSON.stringify(a).match(/phone|97150/),
  );
  const agent = await anon.call('GET', `/v1/agents/${a[0].id}`);
  check('پروفایل مشاور', agent.status === 200 && agent.data.name);

  console.log('\n— آگهی (خواندن)');
  const [row] = await db.primary
    .select({ publicId: listings.publicId, id: listings.id })
    .from(listings)
    // آگهی‌های حذف‌شده (soft delete) هنوز status فعال دارند؛ نباید انتخاب شوند
    .where(and(eq(listings.status, 'active'), isNull(listings.deletedAt)))
    .limit(1);
  const detail = await anon.call('GET', `/v1/listings/${row.publicId}`);
  const d = detail.data;
  check(
    'جزئیات آگهی: مشخصات، مکان، مشاور، رسانه',
    detail.status === 200 &&
      d.title &&
      d.place?.nameFa &&
      d.community?.slug &&
      d.media?.length >= 3 &&
      d.agent !== undefined &&
      !d.ownerId &&
      !d.id,
  );
  check(
    'رسانه‌ها آماده با blurhash و variants',
    d.media.every((m) => m.blurhash && m.variants?.avif?.['640']),
  );
  check('نقطه‌ی جغرافیایی داخل دبی', d.coordinates.lat > 24.5 && d.coordinates.lat < 25.5 && d.coordinates.lng > 54.8 && d.coordinates.lng < 55.7);
  check('شناسه‌ی نامعتبر ۴۰۴', (await anon.call('GET', '/v1/listings/not-an-id')).status === 404);
  check(
    'شناسه‌ی معتبر ولی ناموجود ۴۰۴',
    (await anon.call('GET', '/v1/listings/AAAAAAAAAA')).status === 404,
  );
  for (const [m, p] of [
    ['GET', '/v1/favorites'],
    ['GET', '/v1/listings/mine'],
    ['PUT', `/v1/favorites/${row.publicId}`],
    ['POST', '/v1/listings'],
    ['POST', '/v1/media/presign'],
  ]) {
    const r = await anon.call(m, p, { body: m === 'POST' ? {} : undefined });
    check(
      `${m} ${p.split('/').slice(0, 3).join('/')} بدون ورود → ۴۰۱`,
      r.status === 401,
      String(r.status),
    );
  }

  console.log('\n— ورود با OTP');
  check(
    'شماره‌ی نامعتبر ۴۰۰',
    (await client().call('POST', '/v1/auth/otp/request', { body: { phone: 'abc' } })).status ===
      400,
  );
  check(
    'پیش‌شماره‌ی غیرمجاز ۴۰۰',
    (await client().call('POST', '/v1/auth/otp/request', { body: { phone: '+12025550100' } }))
      .status === 400,
  );

  const phoneA = `9715${String(Date.now()).slice(-8)}`;
  const phoneB = `9715${String(Date.now() + 7).slice(-8)}`;
  const { c: A, user: userA, requestRes } = await login(phoneA);
  check('ورود موفق، کاربر ساخته شد', userA.phone === phoneA && userA.role === 'user');
  check(
    'کوکی httpOnly تنظیم شد',
    [...A.jar.keys()].includes('ashian_at') && [...A.jar.keys()].includes('ashian_rt'),
  );
  const cooldown = await client().call('POST', '/v1/auth/otp/request', { body: { phone: phoneA } });
  check('درخواست مجدد فوری OTP → ۴۲۹', cooldown.status === 429);
  const c3 = client();
  const r3 = await c3.call('POST', '/v1/auth/otp/request', {
    body: { phone: `9715${String(Date.now() + 99).slice(-8)}` },
  });
  const wrong = await c3.call('POST', '/v1/auth/otp/verify', {
    body: {
      phone: `9715${String(Date.now() + 99).slice(-8)}`,
      code: r3.data.devCode === '11111' ? '22222' : '11111',
    },
  });
  check('کد اشتباه → ۴۰۱ و بدون کوکی', wrong.status === 401 && c3.jar.size === 0);
  check(
    'GET /auth/me',
    (await A.call('GET', '/auth/me'.replace('/auth', '/v1/auth'))).data.user.id === userA.id,
  );
  const setCookie = (
    await fetch(`${API}/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: `9715${String(Date.now() + 5).slice(-8)}` }),
    })
  ).status;
  check('پاسخ OTP در حالت توسعه devCode دارد', !!requestRes.data.devCode && setCookie === 200);

  console.log('\n— علاقه‌مندی‌ها');
  check('افزودن (۲۰۴)', (await A.call('PUT', `/v1/favorites/${row.publicId}`)).status === 204);
  check(
    'افزودن مجدد ایدم‌پوتنت (۲۰۴)',
    (await A.call('PUT', `/v1/favorites/${row.publicId}`)).status === 204,
  );
  const ids = await A.call('GET', '/v1/favorites/ids');
  check(
    'فهرست شناسه‌ها شامل آگهی',
    ids.data.ids.includes(row.publicId) && ids.data.ids.length === 1,
  );
  const favDetail = await A.call('GET', `/v1/listings/${row.publicId}`);
  check(
    'isFavorite در جزئیات برای کاربر واردشده',
    favDetail.data.isFavorite === true && detail.data.isFavorite === false,
  );
  const favList = await A.call('GET', '/v1/favorites');
  check(
    'لیست علاقه‌مندی‌ها: کارت با عکس',
    favList.data.items.length === 1 && favList.data.items[0].cover?.blurhash,
  );
  check(
    'آگهی ناموجود در علاقه‌مندی ۴۰۴',
    (await A.call('PUT', '/v1/favorites/AAAAAAAAAA')).status === 404,
  );
  check(
    'حذف (۲۰۴)',
    (await A.call('DELETE', `/v1/favorites/${row.publicId}`)).status === 204 &&
      (await A.call('GET', '/v1/favorites/ids')).data.ids.length === 0,
  );

  console.log('\n— ساخت آگهی');
  const [loc] = await db.primary
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.slug, 'marina-gate-1'))
    .limit(1);
  const [am] = await db.primary.select({ id: amenities.id }).from(amenities).limit(2);
  const input = {
    dealType: 'rent',
    propertyType: 'apartment',
    locationId: loc.id,
    title: 'دو خوابه‌ي مبله در مارینا گیت',
    description: 'آپارتمان نورگير با منظره‌ی دریا.',
    price: 135000,
    rentCheques: [1, 4],
    deposit: 6750,
    bedrooms: 2,
    bathrooms: 2,
    areaSqft: 1250,
    floor: 18,
    buildYear: 2018,
    furnishing: 'furnished',
    parkingSpaces: 1,
    amenityIds: [am.id],
  };
  const bad = await A.call('POST', '/v1/listings', {
    body: { ...input, areaSqft: 500000, title: 'ا' },
  });
  check('ورودی نامعتبر ۴۰۰ با خطای هر فیلد', bad.status === 400 && bad.data.errors?.length >= 2);
  const mismatch = await A.call('POST', '/v1/listings', {
    body: { ...input, bedrooms: 6, areaSqft: 400 },
  });
  check('خواب نامتناسب با متراژ ۴۰۰', mismatch.status === 400);
  const created = await A.call('POST', '/v1/listings', { body: input });
  check(
    'ساخت پیش‌نویس (۲۰۱) با publicId و کد',
    created.status === 201 &&
      created.data.publicId?.length === 10 &&
      created.data.code >= 10000 &&
      created.data.status === 'draft',
    JSON.stringify(created.data),
  );
  const pid = created.data.publicId;
  const weird = await A.call('POST', '/v1/listings', {
    body: {
      ...input,
      areaSqft: 41000,
      bedrooms: 4,
      propertyType: 'townhouse',
      dealType: 'sale',
      price: 3000000,
    },
  });
  check(
    'متراژ غیرعادی (۴۱ هزار فوت) هشدار می‌گیرد',
    weird.status === 201 && weird.data.warnings.some((w) => w.code === 'area_unusual'),
  );
  const own = await A.call('GET', `/v1/listings/${pid}`);
  check(
    'مالک پیش‌نویس را می‌بیند، مهمان نه',
    own.status === 200 &&
      own.data.isOwner &&
      (await anon.call('GET', `/v1/listings/${pid}`)).status === 404,
  );
  const submit0 = await A.call('POST', `/v1/listings/${pid}/submit`);
  check('ارسال بدون ۳ عکس → ۴۲۲', submit0.status === 422, String(submit0.status));

  console.log('\n— آپلود عکس (presigned → worker)');
  const bytes = makePng();
  check(
    'نوع svg رد می‌شود',
    (
      await A.call('POST', '/v1/media/presign', {
        body: { listingPublicId: pid, contentType: 'image/svg+xml', sizeBytes: 100 },
      })
    ).status === 400,
  );
  check(
    'حجم بیش از حد رد می‌شود',
    (
      await A.call('POST', '/v1/media/presign', {
        body: { listingPublicId: pid, contentType: 'image/png', sizeBytes: 99_000_000 },
      })
    ).status === 400,
  );

  const mediaIds = [];
  for (let i = 0; i < 3; i++) {
    const p = await A.call('POST', '/v1/media/presign', {
      body: { listingPublicId: pid, contentType: 'image/png', sizeBytes: bytes.length },
    });
    if (p.status !== 200 && p.status !== 201)
      throw new Error(`presign ناموفق ${p.status} ${JSON.stringify(p.data)}`);
    const { mediaId, upload } = p.data;
    mediaIds.push(mediaId);
    const url = upload.url.replace(/^https?:\/\/[^/]+/, API);
    if (i === 0) {
      const wrongType = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg' },
        body: bytes,
      });
      check('آپلود با Content-Type متفاوت رد می‌شود', wrongType.status === 400);
      const fake = await fetch(url, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: Buffer.from('<html><script>alert(1)</script></html>'),
      });
      check('فایل جعلی (HTML با نوع PNG) رد می‌شود', fake.status === 400);
      const tampered = await fetch(url.slice(0, -3) + 'abc', {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: bytes,
      });
      check('توکن دست‌کاری‌شده رد می‌شود', tampered.status === 400);
      const early = await A.call('POST', `/v1/media/${mediaId}/complete`);
      check('complete قبل از آپلود → ۴۰۰', early.status === 400);
    }
    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: bytes,
    });
    check(`آپلود عکس ${i + 1} (۲۰۴)`, put.status === 204, String(put.status));
    const done = await A.call('POST', `/v1/media/${mediaId}/complete`);
    check(
      `complete عکس ${i + 1}: در حال پردازش`,
      done.status === 200 && done.data.status === 'processing',
    );
  }
  const t0 = Date.now();
  const readyMedia = await waitFor(async () => {
    const all = await Promise.all(mediaIds.map((id) => A.call('GET', `/v1/media/${id}`)));
    return all.every((r) => r.data.status === 'ready')
      ? all
      : all.some((r) => r.data.status === 'failed')
        ? 'failed'
        : null;
  }, 90_000);
  check(
    `worker هر ۳ عکس را پردازش کرد (${((Date.now() - t0) / 1000).toFixed(1)} ثانیه)`,
    Array.isArray(readyMedia),
    String(readyMedia),
  );
  if (Array.isArray(readyMedia)) {
    const m = readyMedia[0].data;
    check(
      'variants: AVIF و WebP در چند عرض + blurhash',
      m.variants.avif['320'] &&
        m.variants.avif['640'] &&
        m.variants.webp['640'] &&
        m.blurhash &&
        m.width === 800 &&
        m.height === 600,
      JSON.stringify(m.variants),
    );
    const file = await client().call('GET', `/media/${m.variants.webp['640']}`);
    check(
      'فایل پردازش‌شده سرو می‌شود (image/webp، کش immutable)',
      file.status === 200 &&
        file.headers.get('content-type') === 'image/webp' &&
        /immutable/.test(file.headers.get('cache-control') ?? ''),
    );
    const orig = await client().call('GET', `/media/listings/x/y/original.png`);
    check('فایل اصلی/خام سرو نمی‌شود (۴۰۴)', orig.status === 404);
  }
  check(
    'path traversal در /media ← ۴۰۴ (نه نشت فایل)',
    [404, 400].includes((await client().call('GET', '/media/..%2f..%2f..%2f.env')).status),
  );

  console.log('\n— ترتیب، ویرایش، ارسال');
  const reversed = [...mediaIds].reverse();
  check(
    'تغییر ترتیب رسانه (۲۰۴)',
    (await A.call('PUT', '/v1/media/reorder', { body: { listingPublicId: pid, order: reversed } }))
      .status === 204,
  );
  const after = await A.call('GET', `/v1/listings/${pid}`);
  check('عکس اصلی عوض شد', after.data.media[0].id === reversed[0]);
  check(
    'ویرایش قیمت و عنوان',
    (
      await A.call('PATCH', `/v1/listings/${pid}`, {
        body: { price: 128000, title: 'دو خوابه‌ی مبله با منظره‌ی دریا' },
      })
    ).status === 200 && (await A.call('GET', `/v1/listings/${pid}`)).data.price === 128000,
  );
  check(
    'ویرایش نامعتبر ۴۰۰',
    (await A.call('PATCH', `/v1/listings/${pid}`, { body: { areaSqft: 999999 } })).status === 400,
  );
  const rev = await A.call('GET', `/v1/listings/${pid}/review`);
  check(
    'پیش‌نمایش ارسال: ۳ عکس آماده، هشدار و تکراری آرایه‌اند',
    rev.status === 200 &&
      rev.data.photos.ready === 3 &&
      Array.isArray(rev.data.warnings) &&
      Array.isArray(rev.data.duplicates),
    JSON.stringify(rev.data),
  );
  if (rev.data.warnings.length + rev.data.duplicates.length > 0) {
    const blocked = await A.call('POST', `/v1/listings/${pid}/submit`);
    check(
      'هشدار یا تکراری بدون تأیید ← ۴۰۹ needs_confirmation',
      blocked.status === 409 && blocked.data.code === 'needs_confirmation',
      JSON.stringify(blocked.data),
    );
  }
  const submit = await A.call('POST', `/v1/listings/${pid}/submit`, { body: { confirm: true } });
  check(
    'ارسال برای بررسی → pending_review',
    submit.status === 200 && submit.data.status === 'pending_review',
  );
  check('ارسال مجدد ۴۰۹', (await A.call('POST', `/v1/listings/${pid}/submit`)).status === 409);
  const mine = await A.call('GET', '/v1/listings/mine?status=pending_review');
  check(
    '«آگهی‌های من» با فیلتر وضعیت',
    mine.data.items.length === 1 && mine.data.items[0].publicId === pid && mine.data.items[0].cover,
  );

  console.log('\n— کنترل دسترسی (کاربر دیگر)');
  const { c: B } = await login(phoneB);
  check(
    'ویرایش آگهی دیگری → ۴۰۳',
    (await B.call('PATCH', `/v1/listings/${pid}`, { body: { price: 1000 } })).status === 403,
  );
  check('حذف آگهی دیگری → ۴۰۳', (await B.call('DELETE', `/v1/listings/${pid}`)).status === 403);
  check(
    'presign روی آگهی دیگری → ۴۰۳',
    (
      await B.call('POST', '/v1/media/presign', {
        body: { listingPublicId: pid, contentType: 'image/png', sizeBytes: 10 },
      })
    ).status === 403,
  );
  check(
    'حذف رسانه‌ی دیگری → ۴۰۳',
    (await B.call('DELETE', `/v1/media/${mediaIds[0]}`)).status === 403,
  );
  check(
    'آگهی در انتظار تأیید برای کاربر دیگر ۴۰۴',
    (await B.call('GET', `/v1/listings/${pid}`)).status === 404,
  );
  check(
    'بیرون از نقش: /v1/system ← ۴۰۳',
    (await B.call('GET', '/v1/system/queues')).status === 403,
  );

  console.log('\n— نشست و خروج');
  const oldRefresh = A.jar.get('ashian_rt');
  const ref = await A.call('POST', '/v1/auth/refresh');
  check('refresh موفق و چرخش توکن', ref.status === 200 && A.jar.get('ashian_rt') !== oldRefresh);
  const replay = client();
  replay.jar.set('ashian_rt', oldRefresh);
  check(
    'استفاده‌ی مجدد از refresh قدیمی ← ۴۰۱',
    (await replay.call('POST', '/v1/auth/refresh')).status === 401,
  );
  check(
    'Bearer نامعتبر ← ۴۰۱',
    (
      await client().call('GET', '/v1/auth/me', {
        headers: { authorization: 'Bearer abc.def.ghi' },
      })
    ).status === 401,
  );
  check(
    'حذف آگهی توسط مالک (۲۰۴) و ۴۰۴ بعدش',
    (await A.call('DELETE', `/v1/listings/${pid}`)).status === 204 &&
      (await A.call('GET', `/v1/listings/${pid}`)).status === 404,
  );
  check(
    'خروج (۲۰۴) و ۴۰۱ بعدش',
    (await A.call('POST', '/v1/auth/logout')).status === 204 &&
      (await A.call('GET', '/v1/auth/me')).status === 401,
  );

  console.log('\n— ادمین و صف');
  const admin = await login('971500000000');
  const q = await admin.c.call('GET', '/v1/system/queues');
  check('ادمین به وضعیت صف‌ها دسترسی دارد', q.status === 200 && q.data.media);

  console.log('\n— شمارش بازدید (صف → worker)');
  for (let i = 0; i < 3; i++)
    await anon.call('POST', `/v1/listings/${row.publicId}/view`, {
      headers: { 'user-agent': `smoke-${i}` },
    });
  const viewed = await waitFor(
    async () => {
      const [v] = await db.primary
        .select()
        .from(listingViews)
        .where(eq(listingViews.listingId, row.id))
        .limit(1);
      return v && v.views >= 3 ? v : null;
    },
    45_000,
    1000,
  );
  check('بازدیدها به‌صورت تجمیعی ثبت شد', !!viewed, 'worker بازدیدها را پردازش نکرد');

  console.log('\n— صفحه‌ی آگهی (مشابه، محله، نزدیک‌ها، lead، گزارش)');
  const lid = row.publicId;
  const similar = await anon.call('GET', `/v1/listings/${lid}/similar`);
  check(
    'مشابه: کارت‌ها بدون خود آگهی',
    similar.status === 200 &&
      Array.isArray(similar.data) &&
      similar.data.every((c) => c.publicId !== lid),
  );
  const nbhd = await anon.call('GET', `/v1/listings/${lid}/neighborhood`);
  check('آمار محله', nbhd.status === 200 && nbhd.data.all.count >= 0 && !!nbhd.data.community);
  const near = await anon.call('GET', `/v1/listings/${lid}/nearby`);
  check(
    'نزدیک‌ترین‌ها با فاصله و زمان پیاده',
    near.status === 200 &&
      near.data.items.every((p) => p.distanceM >= 0 && p.walkMinutes >= 1),
  );
  const callLead = await anon.call('POST', `/v1/listings/${lid}/leads`, { body: { type: 'call' } });
  check('lead تماس: شماره‌ی E.164', callLead.status === 200 && /^\+\d{8,15}$/.test(callLead.data.phone));
  const waLead = await anon.call('POST', `/v1/listings/${lid}/leads`, { body: { type: 'whatsapp' } });
  check('lead واتساپ: لینک wa.me', waLead.status === 200 && waLead.data.whatsappUrl?.startsWith('https://wa.me/'));
  const guestMsg = await anon.call('POST', `/v1/listings/${lid}/leads`, {
    body: { type: 'message', message: 'سلام، هنوز موجود است؟' },
  });
  check('پیام مهمان بدون نام و شماره ۴۰۰', guestMsg.status === 400);
  const badReport = await anon.call('POST', `/v1/listings/${lid}/report`, {
    body: { reason: 'other' },
  });
  check('گزارش «مورد دیگر» بدون توضیح ۴۰۰', badReport.status === 400);
  const okReport = await anon.call('POST', `/v1/listings/${lid}/report`, {
    body: { reason: 'duplicate' },
  });
  check('گزارش آگهی ثبت شد', okReport.status === 200 && okReport.data.ok === true);

  console.log('\n— جستجو');
  const s1 = await anon.call('GET', '/v1/search/listings?dealType=rent&bedroomsMin=1');
  check(
    'نتایج با facet و جمع',
    s1.status === 200 &&
      s1.data.items.length > 0 &&
      s1.data.total > 0 &&
      s1.data.facets.dealType.some((o) => o.value === 'rent'),
  );
  check(
    'فیلتر دقیق اعمال می‌شود',
    s1.data.items.every((i) => i.dealType === 'rent' && i.bedrooms >= 1),
  );
  const featuredAt = s1.data.items.flatMap((i, n) => (i.placement === 'featured' ? [n] : []));
  check(
    'حداکثر ۳ ویژه، در جایگاه‌های ثابت',
    featuredAt.length <= 3 && featuredAt.every((n) => [0, 4, 8].includes(n)),
    JSON.stringify(featuredAt),
  );
  let run = 1;
  let maxRun = 1;
  for (let i = 1; i < s1.data.items.length; i++) {
    const same =
      s1.data.items[i].agent?.id && s1.data.items[i].agent.id === s1.data.items[i - 1].agent?.id;
    run = same ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  check('حداکثر ۲ آگهی پشت‌سرهم از یک مشاور', maxRun <= 2, `max=${maxRun}`);
  check(
    'روی هر کارت تاریخ انتشار و مشاور هست',
    s1.data.items.every((i) => i.publishedAt && (i.agent === null || i.agent.name)),
  );
  const s2 = await anon.call('GET', '/v1/search/listings?dealType=rent&bedroomsMin=1&page=2');
  const ids1 = new Set(s1.data.items.map((i) => i.publicId));
  check(
    'صفحه‌ی دوم بدون تکرار',
    s2.data.items.length > 0 && s2.data.items.every((i) => !ids1.has(i.publicId)),
  );
  check(
    'فیلتر نامعتبر ۴۰۰',
    (await anon.call('GET', '/v1/search/listings?priceMin=9&priceMax=1')).status === 400,
  );

  const sw = await anon.call('GET', '/v1/search/suggest?q=' + encodeURIComponent('مارین'));
  check(
    'پیشنهاد خودکار (محله)',
    sw.status === 200 && sw.data.items.some((i) => i.kind === 'community'),
  );
  const pm = await anon.call('GET', '/v1/search/map?bbox=54.9,24.9,55.6,25.4&zoom=10');
  check(
    'نقشه: خوشه‌ها و جمع',
    pm.status === 200 && pm.data.total > 0 && pm.data.clusters.length > 0,
  );
  const withCode = await anon.call('GET', `/v1/search/listings?q=${s1.data.items[0].code}`);
  check('جستجو با کد آگهی', withCode.data.items[0]?.publicId === s1.data.items[0].publicId);

  // همگام‌سازی: ویرایش آگهی فعال توسط مالک ← job صف ← ایندکس
  const [ownerRow] = await db.primary
    .select({ phone: schema.users.phone, price: listings.price })
    .from(listings)
    .innerJoin(schema.users, eq(schema.users.id, listings.ownerId))
    .where(eq(listings.id, row.id));
  const owner = await login(ownerRow.phone);
  const newPrice = ownerRow.price + 1000;
  const edit = await owner.c.call('PATCH', `/v1/listings/${row.publicId}`, {
    body: { price: newPrice },
  });
  check('مالک آگهی فعال را ویرایش می‌کند', edit.status === 200, JSON.stringify(edit.data));
  // نتیجه‌ی جستجو ۱۵ ثانیه کش می‌شود؛ هر پرس‌وجو سقف قیمت کمی متفاوت (و بی‌اثر) دارد تا کش را دور بزند
  let probe = 20;
  const bySearch = async () => {
    const code = (await anon.call('GET', `/v1/listings/${row.publicId}`)).data.code;
    const r = await anon.call(
      'GET',
      `/v1/search/listings?q=${code}&priceMax=${1_000_000_000 + probe++}`,
    );
    if (r.status !== 200) console.log(`    (جستجو ${r.status}: ${JSON.stringify(r.data)})`);
    return r.data.items?.[0];
  };
  const reflected = await waitFor(
    async () => ((await bySearch())?.price === newPrice ? true : null),
    45_000,
    1000,
  );
  check('تغییر قیمت در جستجو دیده می‌شود (sync)', !!reflected, 'job search.sync-listing اجرا نشد');
  const back = await owner.c.call('PATCH', `/v1/listings/${row.publicId}`, {
    body: { price: ownerRow.price },
  });
  const restored = await waitFor(
    async () => ((await bySearch())?.price === ownerRow.price ? true : null),
    45_000,
    1000,
  );
  check(
    'بازگردانی قیمت هم همگام شد',
    !!restored,
    `PATCH=${back.status} قیمت فعلی در جستجو=${(await bySearch())?.price} انتظار=${ownerRow.price}`,
  );
  const status = await admin.c.call('GET', '/v1/system/search');
  check('ادمین وضعیت ایندکس را می‌بیند', status.status === 200 && status.data.listings > 1000);
  check(
    'کاربر عادی به وضعیت ایندکس دسترسی ندارد',
    (await anon.call('GET', '/v1/system/search')).status === 401,
  );

  console.log('\n— صفحه‌ی نتایج (کارت غنی، هیستوگرام، جستجوی ذخیره‌شده)');
  const card = s1.data.items[0];
  check(
    'کارت: گالری ≤۴ عکس و نشان‌های رسانه',
    Array.isArray(card.photos) &&
      card.photos.length >= 1 &&
      card.photos.length <= 4 &&
      card.photos.every((p) => p.variants?.avif?.['640'] && p.variants?.webp?.['960']) &&
      typeof card.media?.video === 'boolean',
  );
  const hist = s1.data.facets.priceHistogram;
  check(
    'هیستوگرام قیمت: ۲۴ ستون با لبه‌های صعودی و جمع برابر کل',
    hist.edges.length === 25 &&
      hist.edges.every((e, i) => i === 0 || e >= hist.edges[i - 1]) &&
      hist.counts.reduce((a, b) => a + b, 0) === s1.data.total,
  );
  const amen = await anon.call('GET', '/v1/amenities');
  check(
    'فهرست امکانات',
    amen.status === 200 && amen.data.some((a) => a.slug === 'pool' && a.nameFa),
  );

  const savedCreate = await admin.c.call('POST', '/v1/saved-searches', {
    body: {
      name: 'اجاره‌ی دو خوابه',
      query: 'dealType=rent&bedroomsMin=2&page=3',
      frequency: 'daily',
    },
  });
  check(
    'ذخیره‌ی جستجو (۲۰۱)',
    savedCreate.status === 201 && savedCreate.data.id,
    JSON.stringify(savedCreate.data),
  );
  const savedList = await admin.c.call('GET', '/v1/saved-searches');
  const savedMine = savedList.data?.find?.((x) => x.id === savedCreate.data.id);
  check(
    'جستجوی ذخیره‌شده با query استاندارد و بدون page',
    savedMine && savedMine.query === 'bedroomsMin=2&dealType=rent',
    JSON.stringify(savedMine),
  );
  check(
    'فیلتر نامعتبر در جستجوی ذخیره‌شده ۴۰۰',
    (
      await admin.c.call('POST', '/v1/saved-searches', {
        body: { name: 'خراب', query: 'priceMin=9&priceMax=1' },
      })
    ).status === 400,
  );
  check(
    'ذخیره‌ی جستجو بدون ورود ۴۰۱',
    (await anon.call('POST', '/v1/saved-searches', { body: { name: 'x', query: '' } })).status ===
      401,
  );
  check(
    'حذف جستجوی ذخیره‌شده (۲۰۴)',
    (await admin.c.call('DELETE', `/v1/saved-searches/${savedCreate.data.id}`)).status === 204,
  );

  console.log('\n— پنل کاربر (پروفایل، هشدار، اعلان، مقایسه، پیام‌ها)');
  const profile = await admin.c.call('PATCH', '/v1/auth/me', {
    body: { name: 'مدیر آزمایشی', email: 'Admin@Example.com' },
  });
  check(
    'ویرایش پروفایل: نام و ایمیل (کوچک‌شده)',
    profile.status === 200 &&
      profile.data.user.name === 'مدیر آزمایشی' &&
      profile.data.user.email === 'admin@example.com',
    JSON.stringify(profile.data),
  );
  check(
    'ایمیل نامعتبر ۴۰۰',
    (await admin.c.call('PATCH', '/v1/auth/me', { body: { email: 'not-an-email' } })).status === 400,
  );
  check(
    'ویرایش بدون ورود ۴۰۱',
    (await anon.call('PATCH', '/v1/auth/me', { body: { name: 'xx' } })).status === 401,
  );

  const alertSearch = await admin.c.call('POST', '/v1/saved-searches', {
    body: { name: 'اجاره‌های تازه', query: 'dealType=rent', frequency: 'daily', channels: ['push', 'sms'] },
  });
  const alertId = alertSearch.data?.id;
  check('هشدار با کانال‌ها ساخته شد', alertSearch.status === 201 && !!alertId);
  check(
    'کانال خالی ۴۰۰',
    (
      await admin.c.call('POST', '/v1/saved-searches', {
        body: { name: 'خراب', query: 'dealType=rent', channels: [] },
      })
    ).status === 400,
  );
  check(
    'ویرایش تناوب هشدار (۲۰۴)',
    (await admin.c.call('PATCH', `/v1/saved-searches/${alertId}`, { body: { frequency: 'instant' } }))
      .status === 204,
  );
  const alertRow = (await admin.c.call('GET', '/v1/saved-searches')).data.find((s) => s.id === alertId);
  check(
    'فهرست: تناوب و کانال‌ها و آخرین اعلان',
    alertRow?.frequency === 'instant' &&
      alertRow.channels.join() === 'push,sms' &&
      alertRow.lastNotifiedAt,
    JSON.stringify(alertRow),
  );
  check(
    'ویرایش هشدار بدون ورود ۴۰۱',
    (await anon.call('PATCH', `/v1/saved-searches/${alertId}`, { body: { frequency: 'weekly' } }))
      .status === 401,
  );

  // آگهی تازه‌ای منتشر شده که بعد از «آخرین اعلان» باشد: آخرین اعلان را ۱۲۰ روز عقب می‌بریم
  const { savedSearches } = schema;
  await db.primary
    .update(savedSearches)
    .set({ lastNotifiedAt: new Date(Date.now() - 120 * 24 * 3600 * 1000) })
    .where(eq(savedSearches.id, alertId));
  const alertRun = await admin.c.call('POST', '/v1/system/alerts/run');
  check('اجرای فوری job هشدار', alertRun.status === 201 || alertRun.status === 200, JSON.stringify(alertRun.data));
  const note = await waitFor(async () => {
    const r = await admin.c.call('GET', '/v1/notifications?unread=1');
    return r.data?.items?.find((n) => n.type === 'saved-search' && n.payload.savedSearchId === alertId);
  }, 60_000, 1000);
  check(
    'job هشدار اعلان ساخت (نام، تعداد، پیش‌نمایش آگهی)',
    !!note && note.payload.count > 0 && note.payload.listings.length > 0,
    JSON.stringify(note),
  );
  const alertAfter = (await admin.c.call('GET', '/v1/saved-searches')).data.find((s) => s.id === alertId);
  check(
    'زمان آخرین اعلان جلو آمد',
    alertAfter && Date.now() - new Date(alertAfter.lastNotifiedAt).getTime() < 5 * 60_000,
  );
  const unread = await admin.c.call('GET', '/v1/notifications/count');
  check('شمارنده‌ی خوانده‌نشده', unread.status === 200 && unread.data.unread >= 1);
  check(
    'علامت‌گذاری خوانده‌شده (۲۰۴)',
    (await admin.c.call('POST', '/v1/notifications/read', { body: { ids: [note.id] } })).status ===
      204,
  );
  check(
    'اعلان خوانده‌شده در فهرست ناخوانده‌ها نیست',
    !(await admin.c.call('GET', '/v1/notifications?unread=1')).data.items.some((n) => n.id === note.id),
  );
  await admin.c.call('DELETE', `/v1/saved-searches/${alertId}`);

  // مقایسه و کارت‌های دسته‌ای
  const two = (await anon.call('GET', '/v1/search/listings?dealType=rent&pageSize=3&facets=0')).data
    .items;
  const cmp = await anon.call(
    'GET',
    `/v1/listings/compare?ids=${two[0].publicId},${two[1].publicId},BAD!,${two[0].publicId}`,
  );
  check(
    'مقایسه: به ترتیب، بدون تکرار و شناسه‌ی خراب، با امکانات',
    cmp.status === 200 &&
      cmp.data.length === 2 &&
      cmp.data[0].publicId === two[0].publicId &&
      Array.isArray(cmp.data[0].amenities) &&
      typeof cmp.data[0].pricePerSqft === 'number',
  );
  const more = await anon.call(
    'GET',
    `/v1/listings/compare?ids=${two.map((t) => t.publicId).join(',')},aaaaaaaaaa,bbbbbbbbbb,cccccccccc`,
  );
  check('مقایسه حداکثر ۴ ملک', more.status === 200 && more.data.length <= 4);
  const cards = await anon.call('GET', `/v1/listings/cards?ids=${two[1].publicId},${two[0].publicId}`);
  check(
    'کارت‌های دسته‌ای به ترتیب درخواست',
    cards.status === 200 &&
      cards.data.map((c) => c.publicId).join() === `${two[1].publicId},${two[0].publicId}`,
  );
  const myLeads = await admin.c.call('GET', '/v1/leads/mine');
  check('پیام‌های من: ساختار صفحه‌بندی', myLeads.status === 200 && Array.isArray(myLeads.data.items));
  check(
    'پیام‌های من بدون ورود ۴۰۱',
    (await anon.call('GET', '/v1/leads/mine')).status === 401,
  );

  console.log('\n— ویزارد ثبت آگهی (اعتبارسنجی، بازار، تکراری، ارتقا و پرداخت)');
  const W = admin.c;
  // رگرسیون: PATCH جزئی نباید مختصات، امکانات و توضیحات را پاک کند (پیش‌فرض‌های zod)
  const keep = await W.call('POST', '/v1/listings', { body: { ...input, floor: 7, deposit: 5000 } });
  const before = (await W.call('GET', `/v1/listings/${keep.data.publicId}`)).data;
  const patched = await W.call('PATCH', `/v1/listings/${keep.data.publicId}`, { body: { price: 111000 } });
  const afterPatch = (await W.call('GET', `/v1/listings/${keep.data.publicId}`)).data;
  check(
    'PATCH جزئی: مختصات، امکانات، توضیحات، طبقه و ودیعه سالم می‌ماند',
    patched.status === 200 &&
      afterPatch.price === 111000 &&
      afterPatch.coordinates.lng === before.coordinates.lng &&
      afterPatch.coordinates.lat === before.coordinates.lat &&
      afterPatch.coordinates.lng > 50 &&
      afterPatch.amenities.length === before.amenities.length &&
      afterPatch.amenities.length > 0 &&
      afterPatch.description === before.description &&
      afterPatch.floor === 7 &&
      afterPatch.deposit === 5000,
    JSON.stringify({ before: before.coordinates, after: afterPatch.coordinates, am: afterPatch.amenities.length }),
  );
  await W.call('DELETE', `/v1/listings/${keep.data.publicId}`);
  const v1 = await W.call('POST', '/v1/listings/validate', { body: { dealType: 'rent', price: 1000 } });
  check('validate: قیمت خیلی کم → خطای فارسی روی price', v1.status === 200 && !!v1.data.errors.price);
  const v2 = await W.call('POST', '/v1/listings/validate', {
    body: { dealType: 'sale', price: 3000000, bedrooms: 4, areaSqft: 41000 },
  });
  check(
    'validate: متراژ غیرعادی هشدار می‌دهد (مانع نیست)',
    v2.status === 200 &&
      Object.keys(v2.data.errors).length === 0 &&
      v2.data.warnings.some((w) => w.code === 'area_unusual'),
    JSON.stringify(v2.data),
  );
  const v3 = await W.call('POST', '/v1/listings/validate', { body: { lng: 10, lat: 10 } });
  check('validate: نقطه‌ی بیرون از امارات رد می‌شود', !!v3.data.errors.lng || !!v3.data.errors.lat);
  check(
    'validate بدون ورود ۴۰۱',
    (await anon.call('POST', '/v1/listings/validate', { body: {} })).status === 401,
  );
  const mk = await anon.call(
    'GET',
    `/v1/listings/market?locationId=${loc.id}&dealType=rent&bedrooms=2`,
  );
  check(
    'راهنمای قیمت: میانگین محله‌ی والد برج',
    mk.status === 200 && mk.data.all.count > 0 && mk.data.all.avgPrice > 0 && !!mk.data.community.nameFa,
    JSON.stringify(mk.data),
  );
  check(
    'راهنمای قیمت بدون پارامتر ۴۰۰',
    (await anon.call('GET', '/v1/listings/market')).status === 400,
  );

  async function draftWithPhotos() {
    const c = await W.call('POST', '/v1/listings', { body: input });
    const id = c.data.publicId;
    const png = makePng();
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const p = await W.call('POST', '/v1/media/presign', {
        body: { listingPublicId: id, contentType: 'image/png', sizeBytes: png.length },
      });
      await fetch(p.data.upload.url.replace(/^https?:\/\/[^/]+/, API), {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: png,
      });
      await W.call('POST', `/v1/media/${p.data.mediaId}/complete`);
      ids.push(p.data.mediaId);
    }
    const ok = await waitFor(async () => {
      const all = await Promise.all(ids.map((m) => W.call('GET', `/v1/media/${m}`)));
      return all.every((r) => r.data.status === 'ready');
    }, 90_000);
    return { id, ids, ok };
  }

  const X = await draftWithPhotos();
  check('پیش‌نویس اول با ۳ عکس آماده شد', !!X.id && X.ok);
  const [xRow] = await db.primary
    .select({ id: schema.listings.id })
    .from(schema.listings)
    .where(eq(schema.listings.publicId, X.id));
  const xHashes = await db.primary
    .select({ phash: schema.listingMedia.phash })
    .from(schema.listingMedia)
    .where(eq(schema.listingMedia.listingId, xRow.id));
  check(
    'هش ادراکی (۱۶ رقم hex) برای هر عکس ساخته شد',
    xHashes.length === 3 && xHashes.every((h) => /^[0-9a-f]{16}$/.test(h.phash ?? '')),
    JSON.stringify(xHashes),
  );
  // آگهی اول «فعال» می‌شود تا ملاک مقایسه‌ی تکراری باشد
  await db.primary
    .update(schema.listings)
    .set({ status: 'active', publishedAt: new Date() })
    .where(eq(schema.listings.publicId, X.id));

  const Y = await draftWithPhotos();
  const revY = await W.call('GET', `/v1/listings/${Y.id}/review`);
  check(
    'تکراری: همان عکس‌ها در آگهی فعال دیگر پیدا شد',
    revY.status === 200 && revY.data.duplicates.some((d) => d.publicId === X.id && d.reason === 'photos'),
    JSON.stringify(revY.data.duplicates),
  );
  const blockedY = await W.call('POST', `/v1/listings/${Y.id}/submit`);
  check(
    'ارسال آگهی تکراری بدون تأیید ← ۴۰۹ با فهرست تکراری‌ها',
    blockedY.status === 409 &&
      blockedY.data.code === 'needs_confirmation' &&
      blockedY.data.duplicates.length > 0,
  );
  const okY = await W.call('POST', `/v1/listings/${Y.id}/submit`, { body: { confirm: true } });
  check('با تأیید کاربر ارسال می‌شود', okY.status === 200 && okY.data.status === 'pending_review');

  // ارتقا و پرداخت (درگاه ساختگی)
  const packs = await anon.call('GET', '/v1/promotions/featured');
  check('بسته‌های ارتقا با قیمت سمت سرور', packs.status === 200 && packs.data.length >= 2 && packs.data[0].price > 0);
  check(
    'بسته‌ی نامعتبر ۴۰۰',
    (await W.call('POST', `/v1/listings/${X.id}/promote`, { body: { days: 3 } })).status === 400,
  );
  const promo = await W.call('POST', `/v1/listings/${X.id}/promote`, { body: { days: 7 } });
  check(
    'ساخت سفارش: آدرس پرداخت درگاه',
    promo.status === 200 && promo.data.orderId && /\/pay\/mock\//.test(promo.data.redirectUrl),
    JSON.stringify(promo.data),
  );
  const ord = await W.call('GET', `/v1/orders/${promo.data.orderId}`);
  check('سفارش pending با مبلغ بسته', ord.data.status === 'pending' && ord.data.amount === packs.data[0].price);
  check(
    'سفارش دیگران ۴۰۳/۴۰۱',
    [401, 403].includes((await anon.call('GET', `/v1/orders/${promo.data.orderId}`)).status),
  );
  const failed = await W.call('POST', `/v1/payments/mock/${promo.data.orderId}/complete`, {
    body: { outcome: 'failed' },
  });
  check('پرداخت ناموفق: آگهی ویژه نمی‌شود', failed.data.status === 'failed' && (await W.call('GET', `/v1/listings/${X.id}`)).data.tier !== 'featured');
  const promo2 = await W.call('POST', `/v1/listings/${X.id}/promote`, { body: { days: 7 } });
  const paid = await W.call('POST', `/v1/payments/mock/${promo2.data.orderId}/complete`, {
    body: { outcome: 'paid' },
  });
  const paidAgain = await W.call('POST', `/v1/payments/mock/${promo2.data.orderId}/complete`, {
    body: { outcome: 'paid' },
  });
  check('پرداخت موفق (ایدم‌پوتنت)', paid.data.status === 'paid' && paidAgain.data.status === 'paid');
  check('آگهی ویژه شد', (await W.call('GET', `/v1/listings/${X.id}`)).data.tier === 'featured');
  const draftPromo = await W.call('POST', '/v1/listings', { body: input });
  check(
    'ارتقای پیش‌نویس ۴۰۹',
    (await W.call('POST', `/v1/listings/${draftPromo.data.publicId}/promote`, { body: { days: 7 } })).status === 409,
  );
  // پایان مهلت: job دوره‌ای ارتقای تمام‌شده را برمی‌دارد
  await db.primary
    .update(schema.listings)
    .set({ featuredUntil: new Date(Date.now() - 60_000) })
    .where(eq(schema.listings.publicId, X.id));
  await W.call('POST', '/v1/system/alerts/run');
  const expiredOk = await waitFor(
    async () => (await W.call('GET', `/v1/listings/${X.id}`)).data.tier === 'standard',
    60_000,
    1000,
  );
  check('ارتقای تمام‌شده خودکار برداشته شد', !!expiredOk);
  for (const id of [X.id, Y.id, draftPromo.data.publicId]) await W.call('DELETE', `/v1/listings/${id}`);

  console.log('\n— مشاوران و آژانس‌ها (فهرست، پروفایل، پنل، سرنخ، نشان)');
  const agList = await anon.call('GET', '/v1/agents?pageSize=12');
  check(
    'فهرست مشاوران: مشاور برتر اول، با محله و بدون شماره',
    agList.status === 200 &&
      agList.data.items.length > 0 &&
      agList.data.items.every((a) => Array.isArray(a.areas) && !('phone' in a)) &&
      (agList.data.items[0].isTopAgent || !agList.data.items.some((a) => a.isTopAgent)),
  );
  const bySale = await anon.call('GET', '/v1/agents?dealType=sale&sort=listings&pageSize=5');
  check('فیلتر تخصص (فروش) و مرتب‌سازی', bySale.status === 200 && bySale.data.items.length > 0);
  check(
    'فیلتر نامعتبر ۴۰۰',
    (await anon.call('GET', '/v1/agents?dealType=xx')).status === 400 &&
      (await anon.call('GET', '/v1/agents?language=zz')).status === 400,
  );
  const firstAgent = agList.data.items[0];
  const nameQ = encodeURIComponent(firstAgent.name.split(' ')[0]);
  const byName = await anon.call('GET', `/v1/agents?q=${nameQ}`);
  check('جستجوی نام مشاور', byName.data.items.some((a) => a.id === firstAgent.id));
  const prof = await anon.call('GET', `/v1/agents/${firstAgent.id}`);
  check(
    'پروفایل مشاور: تخصص، تاریخ عضویت، محله‌ها',
    prof.status === 200 &&
      Array.isArray(prof.data.deals) &&
      Array.isArray(prof.data.propertyTypes) &&
      !!prof.data.joinedAt,
  );
  const agcs = await anon.call('GET', '/v1/agencies');
  check(
    'فهرست آژانس‌ها: فقط تأییدشده با شمارش مشاور و آگهی',
    agcs.status === 200 && agcs.data.items.length > 0 && agcs.data.items.every((a) => a.isVerified && a.agentCount >= 0),
  );
  const agcProf = await anon.call('GET', `/v1/agencies/${agcs.data.items[0].slug}`);
  check(
    'پروفایل آژانس: تیم و محله‌های فعالیت',
    agcProf.status === 200 && Array.isArray(agcProf.data.team) && Array.isArray(agcProf.data.areas),
  );
  check('آژانس ناموجود ۴۰۴', (await anon.call('GET', '/v1/agencies/no-such-agency')).status === 404);

  // ثبت‌نام مشاور و آژانس
  const stamp = String(Date.now()).slice(-7);
  const ag1 = await login(`971509${stamp}`);
  await sleep(1100);
  const joinBody = { brn: '123456', bio: 'مشاور آزمایشی', languages: ['fa', 'en'], areaIds: [] };
  check(
    'کاربر عادی داشبورد مشاور ندارد (۴۰۳)',
    (await ag1.c.call('GET', '/v1/agent/dashboard')).status === 403,
  );
  check(
    'BRN نامعتبر ۴۰۰',
    (await ag1.c.call('POST', '/v1/agent/join', { body: { ...joinBody, brn: 'abc' } })).status === 400,
  );
  const joined = await ag1.c.call('POST', '/v1/agent/join', { body: joinBody });
  check(
    'ثبت‌نام مشاور: در انتظار تأیید',
    joined.status === 201 && joined.data.verificationStatus === 'pending',
    JSON.stringify(joined.data),
  );
  check('ثبت‌نام مجدد ۴۰۹', (await ag1.c.call('POST', '/v1/agent/join', { body: joinBody })).status === 409);
  const meAg = await ag1.c.call('GET', '/v1/agent/me');
  check('هویت پنل: مشاور (BRN) و بدون آژانس', meAg.data.agent?.brn === '123456' && !meAg.data.managedAgency);
  check(
    'مشاور تأییدنشده در فهرست عمومی نیست',
    !(await anon.call('GET', `/v1/agents?pageSize=50&q=${encodeURIComponent('آزمایشی')}`)).data.items.some(
      (a) => a.id === joined.data.id,
    ),
  );

  // آگهی مشاور → lead → صندوق → وضعیت → زمان پاسخ
  const agListing = await ag1.c.call('POST', '/v1/listings', { body: input });
  const agPid = agListing.data.publicId;
  await db.primary
    .update(schema.listings)
    .set({ status: 'active', publishedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), reviewedAt: new Date() })
    .where(eq(schema.listings.publicId, agPid));
  const agDetail = await ag1.c.call('GET', `/v1/listings/${agPid}`);
  check('آگهی به پروفایل مشاور وصل شد', agDetail.data.agent?.id === joined.data.id);
  const gl = await anon.call('POST', `/v1/listings/${agPid}/leads`, { body: { type: 'call' } });
  const gl2 = await anon.call('POST', `/v1/listings/${agPid}/leads`, {
    body: { type: 'message', name: 'مشتری آزمایشی', phone: '0501234567', message: 'سلام، موجود است؟' },
  });
  check('سرنخ‌ها ثبت شد', gl.status === 200 && gl2.status === 200);
  const inbox = await ag1.c.call('GET', '/v1/agent/leads');
  check(
    'صندوق سرنخ: جدید و با شماره‌ی مشتری برای مشاور',
    inbox.status === 200 &&
      inbox.data.total >= 2 &&
      inbox.data.items.every((l) => l.status === 'new') &&
      inbox.data.items.some((l) => l.phone === '971501234567'),
    JSON.stringify(inbox.data.items?.[0]),
  );
  const msgLead = inbox.data.items.find((l) => l.type === 'message');
  check(
    'تغییر وضعیت سرنخ (۲۰۴) و ثبت زمان پاسخ',
    (await ag1.c.call('PATCH', `/v1/agent/leads/${msgLead.id}`, { body: { status: 'contacted' } })).status === 204 &&
      (await ag1.c.call('GET', '/v1/agent/leads?status=contacted')).data.items[0].firstResponseAt,
  );
  check(
    'وضعیت نامعتبر ۴۰۰',
    (await ag1.c.call('PATCH', `/v1/agent/leads/${msgLead.id}`, { body: { status: 'x' } })).status === 400,
  );
  check(
    'سرنخ دیگران ۴۰۴',
    (await admin.c.call('PATCH', `/v1/agent/leads/${msgLead.id}`, { body: { status: 'closed' } })).status === 403,
  );
  const dash = await ag1.c.call('GET', '/v1/agent/dashboard?days=30');
  check(
    'داشبورد: سرنخ، نرخ، سری روزانه و دلایل نگرفتن نشان',
    dash.status === 200 &&
      dash.data.kpis.leads >= 2 &&
      dash.data.series.length === 30 &&
      dash.data.leadsByType.call >= 1 &&
      dash.data.badge.isTop === false &&
      dash.data.badge.gaps.length > 0 &&
      dash.data.kpis.activeListings === 1,
    JSON.stringify(dash.data.kpis),
  );

  // مدیریت چرخه‌ی عمر
  check('توقف آگهی', (await ag1.c.call('POST', `/v1/agent/listings/${agPid}/pause`)).data.status === 'paused');
  check('آگهی متوقف از دید عموم برداشته شد', (await anon.call('GET', `/v1/listings/${agPid}`)).status === 404);
  check('توقف مجدد ۴۰۹', (await ag1.c.call('POST', `/v1/agent/listings/${agPid}/pause`)).status === 409);
  check('ازسرگیری', (await ag1.c.call('POST', `/v1/agent/listings/${agPid}/resume`)).data.status === 'active');
  const renewed = await ag1.c.call('POST', `/v1/agent/listings/${agPid}/renew`);
  check('تمدید آگهی فعال', renewed.status === 200 && renewed.data.status === 'active');
  check(
    'تمدید آگهی دیگران ۴۰۳',
    (await admin.c.call('POST', `/v1/agent/listings/${agPid}/renew`)).status === 403 ||
      (await anon.call('POST', `/v1/agent/listings/${agPid}/renew`)).status === 401,
  );

  // آژانس: ساخت، تیم، آمار تجمیعی
  // سقف درخواست OTP در دقیقه (۱۰) را رعایت می‌کنیم
  await sleep(62_000);
  const ag2 = await login(`971508${stamp}`);
  await sleep(1100);
  const j2 = await ag2.c.call('POST', '/v1/agent/join', { body: { ...joinBody, brn: '654321' } });
  const mgr = await login(`971507${stamp}`);
  check(
    'ساخت آژانس',
    (
      await mgr.c.call('POST', '/v1/agency', {
        body: { name: 'آژانس آزمایشی', nameEn: `Test Agency ${stamp}`, description: 'تست' },
      })
    ).status === 201,
  );
  check('ساخت آژانس دوم ۴۰۹', (await mgr.c.call('POST', '/v1/agency', { body: { name: 'دوباره' } })).status === 409);
  check(
    'مدیر آژانس در پنل هویت دارد',
    !!(await mgr.c.call('GET', '/v1/agent/me')).data.managedAgency?.slug,
  );
  check(
    'افزودن مشاور به تیم با شماره',
    (await mgr.c.call('POST', '/v1/agency/team', { body: { phone: ag1.user.phone } })).status === 201 &&
      (await mgr.c.call('POST', '/v1/agency/team', { body: { phone: ag2.user.phone } })).status === 201,
  );
  check(
    'شماره‌ی بدون مشاور ۴۰۴',
    (await mgr.c.call('POST', '/v1/agency/team', { body: { phone: '971500000099' } })).status === 404,
  );
  const ov = await mgr.c.call('GET', '/v1/agency/overview');
  check(
    'آمار تجمیعی آژانس: تیم و سرنخ‌ها',
    ov.status === 200 &&
      ov.data.team.length === 2 &&
      ov.data.dashboard.kpis.leads >= 2 &&
      ov.data.agency.agentCount === 2 &&
      ov.data.team[0].leads >= ov.data.team[1].leads,
    JSON.stringify(ov.data.team),
  );
  const agcLeads = await mgr.c.call('GET', '/v1/agency/leads');
  check('سرنخ‌های تیم برای مدیر', agcLeads.status === 200 && agcLeads.data.total >= 2);
  check(
    'مدیر وضعیت سرنخ تیم را عوض می‌کند',
    (await mgr.c.call('PATCH', `/v1/agent/leads/${msgLead.id}`, { body: { status: 'viewing' } })).status === 204,
  );
  check('مشاور غیرمدیر به آمار آژانس دسترسی ندارد', (await ag1.c.call('GET', '/v1/agency/overview')).status === 403);
  check(
    'حذف مشاور از تیم (۲۰۴)',
    (await mgr.c.call('DELETE', `/v1/agency/team/${j2.data.id}`)).status === 204 &&
      (await mgr.c.call('GET', '/v1/agency/overview')).data.team.length === 1,
  );

  // محاسبه‌ی نشان مشاور برتر
  await admin.c.call('POST', '/v1/system/agents/refresh');
  const consistent = await waitFor(async () => {
    const r = await anon.call('GET', '/v1/agents?pageSize=50');
    const tops = r.data.items.filter((a) => a.isTopAgent);
    return tops.every((a) => a.isVerified && (a.rating ?? 0) >= 4.5 && a.reviewCount >= 10) && r.data.items.length > 0
      ? { tops: tops.length }
      : null;
  }, 60_000, 1500);
  check('نشان مشاور برتر فقط با معیارها (امتیاز، نظر، تأیید) داده شد', !!consistent, JSON.stringify(consistent));
  const afterJob = await ag1.c.call('GET', '/v1/agent/dashboard');
  check(
    'میانگین زمان پاسخ از روی وضعیت سرنخ‌ها محاسبه شد',
    afterJob.data.kpis.avgResponseMinutes !== null,
    JSON.stringify(afterJob.data.kpis),
  );
  for (const id of [agPid]) await ag1.c.call('DELETE', `/v1/listings/${id}`);

  console.log('\n— داده‌ی صفحه‌ی اصلی');
  const home = await anon.call('GET', '/v1/home');
  check(
    'ویترین: آمار، محله‌ها و تازه‌های تأییدشده',
    home.status === 200 &&
      home.data.stats.listings > 1000 &&
      home.data.communities.length >= 5 &&
      home.data.communities.every((c) => c.listingCount > 0 && c.path.includes('/')) &&
      home.data.latestVerified.length >= 6 &&
      home.data.latestVerified.every((l) => l.isVerified && l.publishedAt),
  );
  check(
    'ویترین: شمارش نوع ملک برای اجاره و خرید',
    home.data.propertyTypes.rent.length > 0 && home.data.propertyTypes.sale.length > 0,
  );
  check('ویترین: Cache-Control عمومی', /s-maxage/.test(home.headers.get('cache-control') ?? ''));

  console.log('\n— کارایی (جزئیات آگهی ناشناس، کش‌شده)');
  const N = 300;
  const lat = [];
  const t1 = Date.now();
  let idx = 0;
  await Promise.all(
    Array.from({ length: 30 }, async () => {
      while (idx < N) {
        idx++;
        const s = performance.now();
        const r = await fetch(`${API}/v1/listings/${row.publicId}`);
        await r.arrayBuffer();
        lat.push(performance.now() - s);
      }
    }),
  );
  lat.sort((a, b) => a - b);
  const p = (q) => lat[Math.floor(lat.length * q)].toFixed(0);
  const rps = Math.round(N / ((Date.now() - t1) / 1000));
  console.log(
    `    ${N} درخواست با ۳۰ هم‌زمان: ${rps} req/s · p50=${p(0.5)}ms p95=${p(0.95)}ms max=${lat.at(-1).toFixed(0)}ms`,
  );
  check('p95 زیر ۳۰۰ میلی‌ثانیه', Number(p(0.95)) < 300);
} catch (error) {
  failed++;
  console.error('\n✗ اجرا متوقف شد:', error);
} finally {
  await db.close();
}

console.log(
  `\n${failed === 0 ? '✅ همه‌ی بررسی‌ها موفق' : `❌ ${failed} مورد ناموفق`} (${results.filter((r) => r.ok).length}/${results.length})`,
);
process.exit(failed === 0 ? 0 : 1);
