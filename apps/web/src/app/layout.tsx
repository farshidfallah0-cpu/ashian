import { RootProvider } from '@ashian/ui';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import './globals.css';

// فونت‌ها self-hosted هستند (کپی از پکیج‌های fontsource)؛
// next/font آن‌ها را preload می‌کند و font-display: swap اعمال می‌کند.
const estedad = localFont({
  src: '../fonts/estedad-arabic-wght-normal.woff2',
  variable: '--font-estedad',
  weight: '100 900',
  display: 'swap',
});

const vazirmatn = localFont({
  src: '../fonts/vazirmatn-arabic-wght-normal.woff2',
  variable: '--font-vazirmatn',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'آشیان', template: '%s | آشیان' },
  description: 'جستجو و ثبت آگهی اجاره و فروش ملک در دبی، برای فارسی‌زبانان',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
  modal,
}: {
  children: ReactNode;
  /** مسیرهای رهگیری‌شده‌ی Modal (مثل ورود) */
  modal: ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${estedad.variable} ${vazirmatn.variable}`}>
      <body className="overflow-x-clip">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
        >
          رفتن به محتوای اصلی
        </a>
        <RootProvider>
          <SiteHeader />
          {children}
          {modal}
          <SiteFooter />
        </RootProvider>
      </body>
    </html>
  );
}
