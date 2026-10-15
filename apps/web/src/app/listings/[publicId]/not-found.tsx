import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';

/** آگهی وجود ندارد، منقضی یا حذف شده است. */
export default function ListingNotFound() {
  return (
    <main id="main" className="container-page flex min-h-[60vh] flex-col justify-center py-20">
      <p className="font-sans text-sm text-muted">آگهی پیدا نشد</p>
      <h1 className="mt-3 max-w-xl font-display text-3xl text-ink md:text-4xl">
        این آگهی دیگر در دسترس نیست
      </h1>
      <p className="mt-4 max-w-lg text-base text-ink-2">
        ممکن است ملک اجاره یا فروخته شده، آگهی منقضی شده یا نشانی را اشتباه وارد کرده باشید.
        آگهی‌های فعال را جستجو کنید.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/search" className={buttonClasses({ variant: 'dark', size: 'lg' })}>
          جستجوی آگهی‌ها
        </Link>
        <Link href="/" className={buttonClasses({ variant: 'secondary', size: 'lg' })}>
          صفحه‌ی اصلی
        </Link>
      </div>
    </main>
  );
}
