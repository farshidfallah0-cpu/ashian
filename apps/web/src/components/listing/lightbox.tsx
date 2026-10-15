'use client';

import {
  CaretLeft,
  CaretRight,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from '@phosphor-icons/react/ssr';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import type { LightboxImage } from '../../lib/listing';

const faNumber = new Intl.NumberFormat('fa-IR');
const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 320;

const iconButton =
  'flex size-11 items-center justify-center rounded-full text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent';

/**
 * گالری تمام‌صفحه: سوایپ (scroll-snap بومی)، زوم (دکمه، دابل‌تپ، چرخ ماوس) با جابه‌جایی انگشت،
 * کیبورد (←/→ بعدی و قبلی در راست‌چین، +/−، Home/End، Esc) و نوار پیش‌نمایش.
 * فقط بعد از اولین کلیک روی عکس بارگذاری می‌شود.
 */
export default function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);
  // زوم و جابه‌جایی به عکسی که برایش تنظیم شده وابسته است؛ با عوض شدن عکس خودبه‌خود به حالت عادی برمی‌گردد
  const [view, setView] = useState({ for: startIndex, zoom: 1, x: 0, y: 0 });
  const zoom = view.for === index ? view.zoom : 1;
  const pan = view.for === index ? { x: view.x, y: view.y } : { x: 0, y: 0 };
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);
  const total = images.length;

  // باز شدن: dialog مودال، قفل اسکرول صفحه و رفتن به عکس انتخاب‌شده (بدون انیمیشن)
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    track.current?.scrollTo({ left: -startIndex * track.current.clientWidth, behavior: 'instant' });
    return () => {
      document.body.style.overflow = previous;
    };
  }, [startIndex]);

  const goTo = useCallback(
    (target: number, smooth = true) => {
      const el = track.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(total - 1, target));
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // در RTL مقدار scrollLeft منفی است
      el.scrollTo({
        left: -clamped * el.clientWidth,
        behavior: smooth && !reduced ? 'smooth' : 'instant',
      });
    },
    [total],
  );

  // عکس فعال از روی اسکرول
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.min(total - 1, Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        setIndex(next);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [total]);

  // پیش‌نمایش فعال در دید بماند
  useEffect(() => {
    const thumb = thumbs.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [index]);

  const clampPan = useCallback((x: number, y: number, scale: number) => {
    const el = track.current;
    if (!el) return { x: 0, y: 0 };
    const maxX = ((scale - 1) * el.clientWidth) / 2;
    const maxY = ((scale - 1) * el.clientHeight) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  const applyZoom = useCallback(
    (next: number) => {
      const scale = Math.max(1, Math.min(MAX_ZOOM, next));
      setView((v) => {
        const p = v.for === index ? { x: v.x, y: v.y } : { x: 0, y: 0 };
        const clamped = scale === 1 ? { x: 0, y: 0 } : clampPan(p.x, p.y, scale);
        return { for: index, zoom: scale, ...clamped };
      });
    },
    [clampPan, index],
  );

  function onKeyDown(event: KeyboardEvent) {
    // راست‌چین: ← بعدی، → قبلی
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        goTo(index + 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        goTo(index - 1);
        break;
      case 'Home':
        goTo(0);
        break;
      case 'End':
        goTo(total - 1);
        break;
      case '+':
      case '=':
        applyZoom(zoom + 0.75);
        break;
      case '-':
        applyZoom(zoom - 0.75);
        break;
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y, moved: false };
    if (zoom > 1) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || zoom === 1) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    setView({ for: index, zoom, ...clampPan(d.px + dx, d.py + dy, zoom) });
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d || d.moved) return;
    // دابل‌تپ / دابل‌کلیک: زوم رفت‌وبرگشتی
    const now = event.timeStamp;
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      applyZoom(zoom > 1 ? 1 : TAP_ZOOM);
    } else {
      lastTap.current = now;
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-label="گالری تمام‌صفحه"
      onClose={onClose}
      onKeyDown={onKeyDown}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overscroll-contain bg-ink p-0 text-white backdrop:bg-ink animate-fade-in"
    >
      <div className="flex size-full flex-col">
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-5">
          <p className="font-sans text-sm text-white/80" aria-live="polite">
            {faNumber.format(index + 1)} از {faNumber.format(total)}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="کوچک‌نمایی"
              disabled={zoom <= 1}
              onClick={() => applyZoom(zoom - 0.75)}
              className={iconButton}
            >
              <MagnifyingGlassMinus size={22} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="بزرگ‌نمایی"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => applyZoom(zoom + 0.75)}
              className={iconButton}
            >
              <MagnifyingGlassPlus size={22} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="بستن گالری"
              autoFocus
              onClick={() => dialog.current?.close()}
              className={iconButton}
            >
              <X size={22} aria-hidden />
            </button>
          </div>
        </div>

        <div className="group/stage relative min-h-0 flex-1">
          <div
            ref={track}
            className={`scrollbar-none flex size-full snap-x snap-mandatory ${
              zoom > 1 ? 'overflow-x-hidden' : 'overflow-x-auto'
            }`}
          >
            {images.map((image, i) => {
              const active = i === index;
              const near = Math.abs(i - index) <= 1;
              return (
                <div
                  key={i}
                  onPointerDown={active ? onPointerDown : undefined}
                  onPointerMove={active ? onPointerMove : undefined}
                  onPointerUp={active ? onPointerUp : undefined}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragging(false);
                  }}
                  onWheel={
                    active
                      ? (event) => applyZoom(zoom + (event.deltaY < 0 ? 0.4 : -0.4))
                      : undefined
                  }
                  className={`flex size-full shrink-0 snap-center items-center justify-center overflow-hidden px-2 sm:px-16 ${
                    active && zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                  style={{ touchAction: active && zoom > 1 ? 'none' : 'pan-x pan-y' }}
                >
                  <picture
                    className="flex size-full items-center justify-center"
                    style={{
                      transform: active
                        ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`
                        : undefined,
                      transition: dragging ? 'none' : 'transform 220ms var(--ease-out)',
                    }}
                  >
                    {image.avif && (
                      <source type="image/avif" srcSet={image.avif} sizes="100vw" />
                    )}
                    {image.webp && (
                      <source type="image/webp" srcSet={image.webp} sizes="100vw" />
                    )}
                    <img
                      src={image.fallback ?? undefined}
                      alt={image.alt}
                      width={image.width ?? undefined}
                      height={image.height ?? undefined}
                      sizes="100vw"
                      loading={near ? 'eager' : 'lazy'}
                      decoding="async"
                      draggable={false}
                      className="max-h-full max-w-full select-none object-contain"
                    />
                  </picture>
                </div>
              );
            })}
          </div>

          {total > 1 && (
            <>
              <button
                type="button"
                aria-label="عکس قبلی"
                disabled={index === 0}
                onClick={() => goTo(index - 1)}
                className={`${iconButton} absolute end-3 top-1/2 hidden -translate-y-1/2 bg-ink/50 sm:flex`}
              >
                <CaretRight size={24} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="عکس بعدی"
                disabled={index === total - 1}
                onClick={() => goTo(index + 1)}
                className={`${iconButton} absolute start-3 top-1/2 hidden -translate-y-1/2 bg-ink/50 sm:flex`}
              >
                <CaretLeft size={24} aria-hidden />
              </button>
            </>
          )}
        </div>

        {total > 1 && (
          <div
            ref={thumbs}
            className="scrollbar-none flex gap-2 overflow-x-auto px-3 py-3 sm:justify-center sm:px-5"
          >
            {images.map((image, i) => (
              <button
                key={i}
                type="button"
                aria-label={`رفتن به عکس ${faNumber.format(i + 1)}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className={`h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-sm transition-opacity duration-150 ${
                  i === index ? 'opacity-100 outline outline-2 outline-white' : 'opacity-50 hover:opacity-80'
                }`}
              >
                {image.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element -- ریزعکس‌های از پیش ساخته‌شده‌ی خودمان‌اند
                  <img
                    src={image.thumb}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="size-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
