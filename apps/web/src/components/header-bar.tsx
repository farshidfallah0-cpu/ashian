'use client';

import { buttonClasses } from '@ashian/ui';
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';

const BAR_HEIGHT = 80;
const SHRINK = 12;

/**
 * جزیره‌ی کلاینتی هدر: فقط وضعیت اسکرول و باز/بسته بودن منوی موبایل.
 * همه‌ی محتوا (لوگو، لینک‌ها، دکمه‌ها) در سرور رندر می‌شود و به‌صورت children می‌آید،
 * پس هیچ‌کدام از کامپوننت‌هایشان (و کتابخانه‌ی merge کلاس‌ها) به JavaScript صفحه اضافه نمی‌شود.
 *
 * ارتفاع جایگاه ثابت است (بدون CLS)؛ با اسکرول، نوار فقط با transform ۱۲ پیکسل بالا می‌رود.
 * فرزندان با `group-data-[scrolled=true]:` می‌توانند به وضعیت اسکرول واکنش نشان دهند.
 */
export function HeaderBar({
  logo,
  nav,
  actions,
  menu,
  openIcon,
  closeIcon,
}: {
  logo: ReactNode;
  nav: ReactNode;
  actions: ReactNode;
  /** لینک‌های منوی موبایل */
  menu: ReactNode;
  /** آیکون‌ها در سرور رندر می‌شوند تا کتابخانه‌ی آیکون وارد bundle کلاینت نشود */
  openIcon: ReactNode;
  closeIcon: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const shrunk = scrolled && !menuOpen;
  const bordered = scrolled || menuOpen;

  return (
    <header style={{ height: BAR_HEIGHT }} className="relative z-40">
      <div
        data-scrolled={shrunk}
        style={{ height: BAR_HEIGHT, transform: `translateY(${shrunk ? -SHRINK : 0}px)` }}
        className={`group fixed inset-x-0 top-0 border-b bg-bg transition-[transform,border-color] duration-200 ease-out ${
          bordered ? 'border-line' : 'border-transparent'
        }`}
      >
        <div
          style={{ paddingTop: SHRINK }}
          className="container-page flex h-full items-center justify-between gap-6"
        >
          <div className="flex items-center gap-10">
            {logo}
            {nav}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {actions}
            <button
              type="button"
              aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
              className={`${buttonClasses({ variant: 'secondary', size: 'md', icon: true })} lg:hidden`}
            >
              {menuOpen ? closeIcon : openIcon}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            aria-label="منوی موبایل"
            // با کلیک روی هر لینک منو بسته می‌شود
            onClick={(event: MouseEvent) => {
              if ((event.target as HTMLElement).closest('a')) setMenuOpen(false);
            }}
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-5rem)] overflow-y-auto border-b border-line bg-bg shadow-pop lg:hidden"
          >
            <div className="container-page flex flex-col py-2">{menu}</div>
          </nav>
        )}
      </div>
    </header>
  );
}
