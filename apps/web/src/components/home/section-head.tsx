import { ArrowLeft } from '@phosphor-icons/react/ssr';
import Link from 'next/link';

/** سرتیتر مشترک بخش‌ها: خط بالا، عنوان درشت، توضیح کوتاه و لینک اختیاری */
export function SectionHead({
  id,
  title,
  lead,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  lead?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-t border-ink pt-5 md:mb-10">
      <div className="max-w-xl">
        <h2 id={id} className="text-2xl md:text-3xl">
          {title}
        </h2>
        {lead && <p className="mt-2 text-base text-muted">{lead}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="hidden shrink-0 items-center gap-2 text-base text-ink underline decoration-line-strong underline-offset-[6px] hover:decoration-ink sm:inline-flex"
        >
          {linkLabel}
          <ArrowLeft size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
