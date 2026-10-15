'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, apiRequest } from '../../../lib/client-api';
import { faNumber } from '../../../lib/wizard';
import { StepHead } from '../ui';
import type { StepProps } from '../types';

type Kind = 'image' | 'floorplan';
type State = 'uploading' | 'processing' | 'ready' | 'failed';

interface Item {
  /** شناسه‌ی رسانه روی سرور (بعد از presign)؛ تا آن موقع شناسه‌ی موقت */
  id: string;
  kind: Kind;
  state: State;
  progress: number;
  preview: string | null;
  error: string | null;
}

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_BYTES = 15 * 1024 * 1024;
const MIN_PHOTOS = 3;
const MEDIA_BASE = `${API_BASE}/media/`;

interface VariantMap {
  webp?: Record<string, string>;
}

const previewOf = (variants: VariantMap | null | undefined) => {
  const key = variants?.webp?.['640'] ?? variants?.webp?.['320'] ?? variants?.webp?.['960'];
  return key ? MEDIA_BASE + key : null;
};

/** آپلود با XHR (fetch رویداد پیشرفت آپلود ندارد) */
function upload(
  target: {
    method: 'PUT' | 'POST';
    url: string;
    headers?: Record<string, string>;
    fields?: Record<string, string>;
  },
  file: File,
  onProgress: (fraction: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    // آدرس نسبی (حالت lite) نسبت به API است
    const url = target.url.startsWith('http') ? target.url : API_BASE + target.url;
    xhr.open(target.method, url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    if (target.method === 'PUT') {
      for (const [k, v] of Object.entries(target.headers ?? {})) xhr.setRequestHeader(k, v);
      xhr.send(file);
    } else {
      const form = new FormData();
      for (const [k, v] of Object.entries(target.fields ?? {})) form.append(k, v);
      form.append('file', file);
      xhr.send(form);
    }
  });
}

export default function MediaStep({ draft }: StepProps) {
  const publicId = draft.publicId!;
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragId = useRef<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patch = useCallback((id: string, change: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }, []);

  // رسانه‌های موجود (ادامه‌ی پیش‌نویس)
  useEffect(() => {
    let alive = true;
    apiRequest(`/v1/listings/${publicId}`).then(async (response) => {
      if (!alive) return;
      if (response?.ok) {
        const detail = (await response.json()) as {
          media: Array<{ id: string; kind: string; status: string; variants: VariantMap | null }>;
        };
        const fromServer: Item[] = detail.media
          .filter((m) => m.kind === 'image' || m.kind === 'floorplan')
          .map((m) => ({
            id: m.id,
            kind: m.kind as Kind,
            state: m.status === 'ready' ? 'ready' : m.status === 'failed' ? 'failed' : 'processing',
            progress: 1,
            preview: previewOf(m.variants),
            error: m.status === 'failed' ? 'پردازش این عکس ناموفق بود؛ حذف و دوباره آپلود کنید.' : null,
          }));
        // ادغام (نه جایگزینی): فایل‌هایی که کاربر همین حالا رها کرده نباید پاک شوند
        setItems((list) => [...fromServer.filter((s) => !list.some((l) => l.id === s.id)), ...list]);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [publicId]);

  // پیگیری پردازش (worker) تا آماده شدن
  useEffect(() => {
    const timer = setInterval(async () => {
      for (const item of itemsRef.current.filter((i) => i.state === 'processing')) {
        const response = await apiRequest(`/v1/media/${item.id}`);
        if (!response?.ok) continue;
        const status = (await response.json()) as { status: string; variants: VariantMap | null };
        if (status.status === 'ready') patch(item.id, { state: 'ready', preview: previewOf(status.variants) ?? item.preview });
        else if (status.status === 'failed')
          patch(item.id, { state: 'failed', error: 'پردازش این عکس ناموفق بود.' });
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [patch]);

  async function addFiles(files: FileList | File[], kind: Kind) {
    setNotice(null);
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type)) {
        setNotice(`«${file.name}» تصویر مجاز نیست (JPG، PNG، WebP یا AVIF).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setNotice(`«${file.name}» بزرگ‌تر از ۱۵ مگابایت است.`);
        continue;
      }
      const temp = `tmp-${crypto.randomUUID()}`;
      const preview = URL.createObjectURL(file);
      setItems((list) => [
        ...list,
        { id: temp, kind, state: 'uploading', progress: 0, preview, error: null },
      ]);
      void (async () => {
        const fail = (message: string) => patch(temp, { state: 'failed', error: message });
        const presign = await apiRequest('/v1/media/presign', {
          method: 'POST',
          body: JSON.stringify({
            listingPublicId: publicId,
            kind,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        });
        if (!presign?.ok) {
          let message = 'آماده‌سازی آپلود ناموفق بود.';
          try {
            message = ((await presign?.json()) as { message?: string }).message ?? message;
          } catch {
            /* بدنه‌ی JSON نبود */
          }
          return fail(message);
        }
        const { mediaId, upload: target } = (await presign.json()) as {
          mediaId: string;
          upload: Parameters<typeof upload>[0];
        };
        setItems((list) => list.map((i) => (i.id === temp ? { ...i, id: mediaId } : i)));
        const ok = await upload(target, file, (p) => patch(mediaId, { progress: p }));
        if (!ok) return patch(mediaId, { state: 'failed', error: 'آپلود ناموفق بود؛ دوباره تلاش کنید.' });
        const done = await apiRequest(`/v1/media/${mediaId}/complete`, { method: 'POST' });
        if (!done?.ok) return patch(mediaId, { state: 'failed', error: 'فایل، تصویر معتبری نبود.' });
        patch(mediaId, { state: 'processing', progress: 1 });
      })();
    }
  }

  async function persistOrder(list: Item[]) {
    const ids = [...list.filter((i) => i.kind === 'image'), ...list.filter((i) => i.kind === 'floorplan')]
      .filter((i) => i.state !== 'uploading' && !i.id.startsWith('tmp-'))
      .map((i) => i.id);
    if (ids.length === 0) return;
    const response = await apiRequest('/v1/media/reorder', {
      method: 'PUT',
      body: JSON.stringify({ listingPublicId: publicId, order: ids }),
    });
    if (!response?.ok) setNotice('ذخیره‌ی ترتیب عکس‌ها ناموفق بود.');
  }

  function move(id: string, to: number) {
    const photos = items.filter((i) => i.kind === 'image');
    const from = photos.findIndex((i) => i.id === id);
    if (from < 0 || to < 0 || to >= photos.length || from === to) return;
    const reordered = [...photos];
    const [picked] = reordered.splice(from, 1);
    reordered.splice(to, 0, picked!);
    const next = [...reordered, ...items.filter((i) => i.kind !== 'image')];
    setItems(next);
    void persistOrder(next);
  }

  async function remove(item: Item) {
    if (item.id.startsWith('tmp-')) return setItems((l) => l.filter((i) => i.id !== item.id));
    const response = await apiRequest(`/v1/media/${item.id}`, { method: 'DELETE' });
    if (response?.ok || response?.status === 404) setItems((l) => l.filter((i) => i.id !== item.id));
    else setNotice('حذف ناموفق بود.');
  }

  const photos = items.filter((i) => i.kind === 'image');
  const plans = items.filter((i) => i.kind === 'floorplan');
  const readyPhotos = photos.filter((i) => i.state === 'ready').length;

  return (
    <div className="grid gap-9">
      <StepHead
        title="عکس‌ها"
        lead={`حداقل ${MIN_PHOTOS.toLocaleString('fa-IR')} عکس لازم است. عکس اول، عکس اصلی آگهی است؛ برای تغییر ترتیب بکشید یا از دکمه‌ها استفاده کنید.`}
      />

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files, 'image');
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed px-6 py-12 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
          dragOver ? 'border-ink bg-surface' : 'border-line-strong hover:border-ink'
        }`}
      >
        <input
          type="file"
          accept={ACCEPT.join(',')}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files, 'image');
            e.target.value = '';
          }}
        />
        <span className="font-display text-lg text-ink">عکس‌ها را اینجا رها کنید</span>
        <span className="mt-1.5 text-base text-muted">یا برای انتخاب از دستگاه بزنید · JPG، PNG، WebP، AVIF تا ۱۵ مگابایت</span>
      </label>

      {notice && (
        <p role="alert" className="text-base text-danger">
          {notice}
        </p>
      )}

      {loaded && (
        <p className="text-sm text-muted" aria-live="polite">
          {faNumber.format(readyPhotos)} عکس آماده
          {readyPhotos < MIN_PHOTOS && ` · ${faNumber.format(MIN_PHOTOS - readyPhotos)} عکس دیگر لازم است`}
        </p>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((item, index) => (
            <li
              key={item.id}
              draggable={item.state === 'ready'}
              onDragStart={() => (dragId.current = item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragId.current && dragId.current !== item.id) move(dragId.current, index);
                dragId.current = null;
              }}
              className="group relative"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
                {item.preview && (
                  // eslint-disable-next-line @next/next/no-img-element -- پیش‌نمایش محلی یا ریزعکس خودمان
                  <img
                    src={item.preview}
                    alt={`عکس ${faNumber.format(index + 1)}`}
                    draggable={false}
                    className={`size-full object-cover ${item.state === 'ready' ? '' : 'opacity-50'}`}
                  />
                )}
                {index === 0 && item.state === 'ready' && (
                  <span className="absolute start-2 top-2 rounded-sm bg-ink px-2 py-0.5 text-xs text-white">
                    عکس اصلی
                  </span>
                )}
                {item.state === 'uploading' && (
                  <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={Math.round(item.progress * 100)}>
                    <div className="h-full origin-right bg-brand" style={{ width: '100%', transform: `scaleX(${item.progress})` }} />
                  </div>
                )}
                {item.state === 'processing' && (
                  <span className="absolute inset-x-2 bottom-2 rounded-sm bg-white px-2 py-0.5 text-center text-xs text-ink-2">در حال پردازش…</span>
                )}
                {item.state === 'failed' && (
                  <span role="alert" className="absolute inset-x-2 bottom-2 rounded-sm bg-danger-soft px-2 py-0.5 text-center text-xs text-danger">
                    {item.error}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1 text-sm">
                <span className="flex gap-0.5">
                  <button type="button" aria-label="جلوتر" disabled={index === 0 || item.state !== 'ready'} onClick={() => move(item.id, index - 1)} className="size-8 rounded-sm text-ink-2 hover:bg-surface disabled:opacity-30">→</button>
                  <button type="button" aria-label="عقب‌تر" disabled={index === photos.length - 1 || item.state !== 'ready'} onClick={() => move(item.id, index + 1)} className="size-8 rounded-sm text-ink-2 hover:bg-surface disabled:opacity-30">←</button>
                  {index > 0 && item.state === 'ready' && (
                    <button type="button" onClick={() => move(item.id, 0)} className="rounded-sm px-2 text-ink-2 hover:bg-surface">اصلی کن</button>
                  )}
                </span>
                <button type="button" onClick={() => void remove(item)} className="rounded-sm px-2 text-danger hover:bg-danger-soft">حذف</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="border-t border-line pt-8">
        <h2 className="font-display text-lg text-ink">نقشه‌ی واحد (اختیاری)</h2>
        <p className="mt-1 text-base text-muted">پلان واحد به خریدار کمک می‌کند چیدمان را بفهمد.</p>
        <label className="mt-3 inline-flex h-11 cursor-pointer items-center rounded-sm border border-line-strong px-5 text-base text-ink hover:border-ink">
          افزودن نقشه
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files, 'floorplan');
              e.target.value = '';
            }}
          />
        </label>
        {plans.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-3">
            {plans.map((item) => (
              <li key={item.id} className="w-40">
                <div className="aspect-[4/3] overflow-hidden rounded-sm bg-surface-2">
                  {item.preview && (
                    // eslint-disable-next-line @next/next/no-img-element -- پیش‌نمایش محلی یا ریزعکس خودمان
                    <img src={item.preview} alt="نقشه‌ی واحد" className="size-full object-contain" />
                  )}
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-muted">{item.state === 'ready' ? 'آماده' : item.state === 'failed' ? 'ناموفق' : 'در حال آپلود'}</span>
                  <button type="button" onClick={() => void remove(item)} className="text-danger">حذف</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}