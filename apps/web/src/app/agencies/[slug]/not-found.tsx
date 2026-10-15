import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';

export default function AgencyNotFound() {
  return (
    <main id="main" className="container-page flex min-h-[50vh] flex-col justify-center py-20">
      <h1 className="font-display text-3xl text-ink">این آژانس پیدا نشد</h1>
      <Link href="/agencies" className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-8 self-start`}>
        فهرست آژانس‌ها
      </Link>
    </main>
  );
}