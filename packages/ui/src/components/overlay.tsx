'use client';

import { X } from '@phosphor-icons/react/ssr';
import { m, useDragControls } from 'motion/react';
import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useIsMobile } from '../lib/hooks';

/**
 * Modal، BottomSheet و Drawer همگی روی Dialog رادیکس ساخته شده‌اند
 * (قفل فوکوس، Escape، aria و بازگرداندن فوکوس رایگان است).
 * انیمیشن ورود/خروج با CSS و فقط transform + opacity.
 */

const overlayClass =
  'fixed inset-0 z-40 bg-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out';

function CloseButton({ className }: { className?: string }) {
  return (
    <Dialog.Close
      aria-label="بستن"
      className={cn(
        'flex size-9 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:bg-surface hover:text-ink',
        className,
      )}
    >
      <X size={18} />
    </Dialog.Close>
  );
}

function Header({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <Dialog.Title className="font-display text-xl font-bold text-ink">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
        )}
      </div>
      <CloseButton className="-me-2 -mt-1" />
    </div>
  );
}

export interface OverlayProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** عنصر فعال‌کننده؛ اگر نبود، کنترل از بیرون با open انجام می‌شود */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** نوار پایین ثابت برای دکمه‌های اقدام */
  footer?: ReactNode;
  className?: string;
}

/** نوار کشیدنی بالای Bottom Sheet */
function Grabber() {
  return (
    <div className="flex justify-center pb-1 pt-3" aria-hidden="true">
      <span className="h-1 w-10 rounded-full bg-line-strong" />
    </div>
  );
}

/**
 * Bottom Sheet: از پایین بالا می‌آید و با کشیدن به پایین بسته می‌شود.
 * بستن با فاصله‌ی بیش از ۱۲۰ پیکسل یا سرعت زیاد.
 */
export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <SheetContent
          title={title}
          description={description}
          footer={footer}
          className={className}
          onDismiss={() => onOpenChange?.(false)}
        >
          {children}
        </SheetContent>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SheetContent({
  title,
  description,
  footer,
  className,
  onDismiss,
  children,
  draggable = true,
}: Pick<OverlayProps, 'title' | 'description' | 'footer' | 'className' | 'children'> & {
  onDismiss: () => void;
  draggable?: boolean;
}) {
  const dragControls = useDragControls();
  return (
    <Dialog.Content asChild>
      <m.div
        drag={draggable ? 'y' : false}
        dragControls={dragControls}
        // کشیدن فقط از سرتیتر شروع می‌شود تا با اسکرول محتوای داخل Sheet تداخل نکند
        dragListener={false}
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 600) onDismiss();
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-lg bg-bg shadow-sheet outline-none',
          'data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out',
          className,
        )}
      >
        <div
          className="touch-none"
          onPointerDown={(e) => {
            // دکمه‌ی بستن باید کلیک شود، نه کشیده
            if (draggable && !(e.target as HTMLElement).closest('button')) dragControls.start(e);
          }}
        >
          <Grabber />
          <Header title={title} description={description} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="border-t border-line bg-bg px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </m.div>
    </Dialog.Content>
  );
}

export interface ModalProps extends OverlayProps {
  /** عرض در دسکتاپ */
  size?: 'sm' | 'md' | 'lg';
}

const modalWidth = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' } as const;

/**
 * Modal: در دسکتاپ وسط صفحه و در موبایل به‌صورت Bottom Sheet قابل کشیدن.
 * کاربر موبایل با شست دسترسی دارد و حس اپلیکیشن می‌گیرد؛ دسکتاپ حس صفحه‌ی مجله.
 */
export function Modal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        trigger={trigger}
        title={title}
        description={description}
        footer={footer}
        className={className}
      >
        {children}
      </BottomSheet>
    );
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed start-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rtl:translate-x-1/2',
            'rounded-lg border border-line bg-bg shadow-pop outline-none',
            'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            modalWidth[size],
            className,
          )}
        >
          <Header title={title} description={description} />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="border-t border-line px-6 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface DrawerProps extends OverlayProps {
  /** سمت ورود: start = سمت شروع متن (راست در فارسی) */
  side?: 'start' | 'end';
}

/** Drawer کناری، مثل پنل فیلترهای بیشتر در دسکتاپ */
export function Drawer({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  side = 'start',
  className,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClass} />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-[min(26rem,100vw-2.5rem)] flex-col bg-bg shadow-pop outline-none',
            side === 'start'
              ? 'start-0 border-e border-line data-[state=open]:animate-drawer-start-in data-[state=closed]:animate-drawer-start-out'
              : 'end-0 border-s border-line data-[state=open]:animate-drawer-end-in data-[state=closed]:animate-drawer-end-out',
            className,
          )}
        >
          <Header title={title} description={description} />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
