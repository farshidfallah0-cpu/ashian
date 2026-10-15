import { buttonClasses } from '@ashian/ui';
import Link from 'next/link';

export default function AgentNotFound() {
  return (
    <main id="main" className="container-page flex min-h-[50vh] flex-col justify-center py-20">
      <h1 className="font-display text-3xl text-ink">این مشاور پیدا نشد</h1>
      <p className="mt-3 max-w-lg text-base text-ink-2">ممکن است نشانی اشتباه باشد یا مشاور دیگر فعال نباشد.</p>
      <Link href="/agents" className={`${buttonClasses({ variant: 'dark', size: 'lg' })} mt-8 self-start`}>
        فهرست مشاوران
      </Link>
    </main>
  );
}