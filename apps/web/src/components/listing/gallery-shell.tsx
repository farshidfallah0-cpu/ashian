'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LightboxImage } from '../../lib/listing';

const loadLightbox = () => import('./lightbox');
/** لایت‌باکس فقط با اولین کلیک (یا هاور) بارگذاری می‌شود؛ جزو JavaScript اولیه نیست */
const Lightbox = dynamic(loadLightbox, { ssr: false });

export interface GalleryPanel {
  id: 'photos' | 'video' | 'tour' | 'floorplan';
  label: string;
  count?: number;
  content: ReactNode;
}

type LightboxSet = 'photos' | 'floorplan';

const faNumber = new Intl.NumberFormat('fa-IR');

/**
 * پوسته‌ی گالری: تب‌ها (عکس / ویدیو / تور ۳۶۰ / نقشه‌ی واحد) و باز کردن لایت‌باکس.
 * خود عکس‌ها در سرور رندر می‌شوند و اینجا فقط children‌اند؛ با event delegation روی
 * `[data-open]` (مقدار «photos:3») کلیک را می‌گیریم.
 */
export function GalleryShell({
  panels,
  sets,
}: {
  panels: GalleryPanel[];
  sets: Record<LightboxSet, LightboxImage[]>;
}) {
  const [active, setActive] = useState(panels[0]?.id ?? 'photos');
  const [open, setOpen] = useState<{ set: LightboxSet; index: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // شمارنده‌ی نوار عکس‌های موبایل (scroll-snap): مستقیم روی DOM تا رندر مجدد لازم نباشد
  useEffect(() => {
    const strip = root.current?.querySelector<HTMLElement>('[data-strip]');
    const counter = root.current?.querySelector<HTMLElement>('[data-strip-counter]');
    if (!strip || !counter) return;
    const total = strip.children.length;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // در RTL مقدار scrollLeft منفی است
        const index = Math.min(total - 1, Math.round(Math.abs(strip.scrollLeft) / strip.clientWidth));
        counter.textContent = `${faNumber.format(index + 1)} از ${faNumber.format(total)}`;
      });
    };
    strip.addEventListener('scroll', update, { passive: true });
    return () => {
      strip.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  }, []);

  function onClick(event: React.MouseEvent) {
    const target = (event.target as Element).closest<HTMLElement>('[data-open]');
    if (!target) return;
    const [set, index] = target.dataset.open!.split(':');
    if (set === 'photos' || set === 'floorplan') setOpen({ set, index: Number(index) || 0 });
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    // در راست‌چین «بعدی» به سمت چپ است
    const delta = event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = panels[(position + delta + panels.length) % panels.length]!;
    setActive(next.id);
    root.current?.querySelector<HTMLElement>(`#gallery-tab-${next.id}`)?.focus();
  }

  return (
    <div ref={root} onClick={onClick} onPointerEnter={() => void loadLightbox()}>
      {panels.length > 1 && (
        <div role="tablist" aria-label="رسانه‌های آگهی" className="mb-3 flex gap-6">
          {panels.map((panel, position) => (
            <button
              key={panel.id}
              id={`gallery-tab-${panel.id}`}
              type="button"
              role="tab"
              aria-selected={active === panel.id}
              aria-controls={`gallery-panel-${panel.id}`}
              tabIndex={active === panel.id ? 0 : -1}
              onClick={() => setActive(panel.id)}
              onKeyDown={(event) => onTabKey(event, position)}
              className={`-mb-px border-b-2 pb-1.5 text-base transition-colors duration-150 ${
                active === panel.id
                  ? 'border-ink text-ink'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {panel.label}
              {panel.count !== undefined && (
                <span className="ms-1.5 text-sm text-muted">{faNumber.format(panel.count)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {panels.map((panel) => (
        <div
          key={panel.id}
          id={`gallery-panel-${panel.id}`}
          role="tabpanel"
          aria-labelledby={`gallery-tab-${panel.id}`}
          hidden={active !== panel.id}
        >
          {panel.content}
        </div>
      ))}

      {open && (
        <Lightbox
          images={sets[open.set]}
          startIndex={open.index}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
