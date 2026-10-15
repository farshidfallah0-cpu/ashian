import { Logo } from '@ashian/ui';
import { LABELS, PROPERTY_TYPES, formatDate, type HomeResponse } from '@ashian/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { apiGet } from '../lib/api';

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <h2 className="font-display text-base text-ink">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">{children}</ul>
    </nav>
  );
}

const linkClass = 'underline-offset-4 hover:text-ink hover:underline';

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      {/* لینک‌های سئو زیاد و کم‌اولویت‌اند؛ prefetch نمی‌شوند */}
      <Link prefetch={false} className={linkClass} href={href}>
        {children}
      </Link>
    </li>
  );
}

/**
 * فوتر کامل با لینک‌های سئو: نوع ملک × معامله و محله‌های پرآگهی.
 * داده‌ی محله‌ها از همان پاسخ کش‌شده‌ی صفحه‌ی اصلی می‌آید (یک درخواست مشترک).
 */
export async function SiteFooter() {
  const home = await apiGet<HomeResponse>('/v1/home', { revalidate: 300 });
  const areas = home?.communities ?? [];
  const year = formatDate(new Date(), 'numeric').split('/')[0];

  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-5 text-sm text-muted">
            آگهی اجاره و خرید ملک در دبی و امارات، برای فارسی‌زبانان. قیمت به درهم، متراژ به فوت
            مربع و مجوز هر آگهی و مشاور قابل بررسی.
          </p>
        </div>

        <Column title="اجاره">
          {PROPERTY_TYPES.map((type) => (
            <FooterLink key={type} href={`/search?dealType=rent&propertyType=${type}`}>
              اجاره‌ی {LABELS.propertyType[type]}
            </FooterLink>
          ))}
        </Column>

        <Column title="خرید">
          {PROPERTY_TYPES.map((type) => (
            <FooterLink key={type} href={`/search?dealType=sale&propertyType=${type}`}>
              خرید {LABELS.propertyType[type]}
            </FooterLink>
          ))}
        </Column>

        <Column title="محله‌های پرآگهی">
          {areas.map((area) => (
            <FooterLink key={area.path} href={`/search?location=${encodeURIComponent(area.path)}`}>
              {area.nameFa}
            </FooterLink>
          ))}
          <FooterLink href="/areas">همه‌ی محله‌ها</FooterLink>
        </Column>

        <Column title="آشیان">
          <FooterLink href="/agents">مشاوران و آژانس‌ها</FooterLink>
          <FooterLink href="/listings/new">ثبت آگهی</FooterLink>
          <FooterLink href="/about">درباره‌ی ما</FooterLink>
          <FooterLink href="/help">راهنما و قوانین</FooterLink>
        </Column>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© آشیان، {year}. همه‌ی قیمت‌ها به درهم امارات است.</p>
          <p>عکس‌های نمونه: Wikimedia Commons (CC0 و Public Domain)؛ هیرو: Robert Bock.</p>
        </div>
      </div>
    </footer>
  );
}
