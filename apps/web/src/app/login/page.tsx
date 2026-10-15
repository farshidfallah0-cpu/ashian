import type { Metadata } from 'next';
import { LoginView } from './login-view';

export const metadata: Metadata = {
  title: 'ورود یا ثبت‌نام',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ next?: string }> };

/** ورود با موبایل. وقتی از داخل سایت باز شود Modal است (app/@modal/(.)login)؛ این صفحه برای لینک مستقیم است. */
export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <main id="main" className="container-page py-14 md:py-24">
      <div className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-20">
        <div>
          <p className="font-sans text-sm text-muted">ورود یا ثبت‌نام</p>
          <h1 className="mt-3 max-w-md font-display text-3xl leading-snug text-ink md:text-4xl">
            برای ذخیره، مقایسه و هشدار آگهی وارد شوید
          </h1>
          <ul className="mt-8 max-w-md space-y-3 text-base text-ink-2">
            {[
              'علاقه‌مندی‌ها و جستجوهای ذخیره‌شده‌تان در همه‌ی دستگاه‌ها می‌ماند.',
              'وقتی آگهی تازه‌ای با فیلترهای شما منتشر شود خبر می‌گیرید.',
              'حساب جدا ندارد: با همین شماره اگر ثبت‌نام نکرده باشید، حساب ساخته می‌شود.',
            ].map((point) => (
              <li key={point} className="flex gap-3">
                <span className="mt-[0.8em] h-px w-4 shrink-0 bg-ink" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="max-w-md self-start rounded-sm border border-line p-6 md:p-8">
          <LoginView next={next} />
        </div>
      </div>
    </main>
  );
}