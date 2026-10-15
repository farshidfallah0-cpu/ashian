import { Button, Logo } from '@ashian/ui';
import { List, Plus, UserCircle, X } from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { AuthSlot } from './auth/auth-slot';
import { HeaderBar } from './header-bar';

export const NAV_LINKS = [
  { href: '/search?dealType=rent', label: 'اجاره' },
  { href: '/search?dealType=sale', label: 'خرید' },
  { href: '/agents', label: 'مشاوران' },
  { href: '/areas', label: 'راهنمای محله‌ها' },
] as const;

const MENU_LINK =
  'flex h-14 items-center border-b border-line font-display text-xl text-ink last:border-b-0';

/**
 * هدر چسبان (سرور). فقط رفتار اسکرول و منوی موبایل در `HeaderBar` (کلاینت) است.
 * لینک‌ها prefetch نمی‌شوند: صفحه‌هایشان پرتعدادند و هیچ‌کدام از مسیرهای اصلی نیستند.
 */
export function SiteHeader() {
  return (
    <HeaderBar
      openIcon={<List size={20} aria-hidden />}
      closeIcon={<X size={20} aria-hidden />}
      logo={
        <Link href="/" aria-label="آشیان، صفحه‌ی اصلی" className="rounded-sm">
          <Logo className="origin-right transition-transform duration-200 ease-out group-data-[scrolled=true]:scale-[0.88]" />
        </Link>
      }
      nav={
        <nav aria-label="منوی اصلی" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              className="relative py-2 text-base text-ink-2 transition-colors hover:text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-right after:scale-x-0 after:bg-ink after:transition-transform after:duration-200 hover:after:scale-x-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
      actions={
        <>
          <AuthSlot
            loggedOut={
              <Link
                href="/login"
                prefetch={false}
                className="hidden h-11 items-center px-3 text-base text-ink-2 hover:text-ink sm:inline-flex"
              >
                ورود
              </Link>
            }
            loggedIn={
              <Link
                href="/account"
                prefetch={false}
                className="hidden h-11 items-center gap-1.5 px-3 text-base text-ink-2 hover:text-ink sm:inline-flex"
              >
                <UserCircle size={22} weight="light" aria-hidden />
                حساب من
              </Link>
            }
          />
          <Button asChild variant="primary" size="md" className="px-4 sm:px-5">
            <Link href="/listings/new" prefetch={false}>
              <Plus size={16} weight="bold" aria-hidden />
              ثبت آگهی
            </Link>
          </Button>
        </>
      }
      menu={[
        ...NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} prefetch={false} className={MENU_LINK}>
            {link.label}
          </Link>
        )),
        <AuthSlot
          key="auth"
          loggedOut={
            <Link href="/login" prefetch={false} className={MENU_LINK}>
              ورود
            </Link>
          }
          loggedIn={
            <Link href="/account" prefetch={false} className={MENU_LINK}>
              حساب من
            </Link>
          }
        />,
      ]}
    />
  );
}
