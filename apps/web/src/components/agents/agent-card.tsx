import { Badge } from '@ashian/ui';
import { LANGUAGE_LABELS, formatNumber, type AgentSummary } from '@ashian/shared';
import { SealCheck, Star } from '@phosphor-icons/react/ssr';
import Link from 'next/link';

type LanguageCode = keyof typeof LANGUAGE_LABELS;

export const languageNames = (codes: string[]) =>
  codes.map((c) => LANGUAGE_LABELS[c as LanguageCode] ?? c).join('، ');

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' | 'xl' }) {
  const box = size === 'xl' ? 'size-24 text-4xl' : size === 'lg' ? 'size-16 text-2xl' : 'size-12 text-lg';
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-brand ${box}`}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null || count === 0) return <span className="text-muted">هنوز نظری ثبت نشده</span>;
  return (
    <span className="flex items-center gap-1 text-ink">
      <Star size={15} weight="fill" aria-hidden />
      <span className="font-bold">{formatNumber(rating, 1)}</span>
      <span className="text-muted">({formatNumber(count, 0)} نظر)</span>
    </span>
  );
}

export function responseText(minutes: number | null): string | null {
  if (minutes === null) return null;
  return minutes < 60
    ? `پاسخ معمولاً زیر ${formatNumber(Math.max(5, Math.ceil(minutes / 5) * 5), 0)} دقیقه`
    : `پاسخ معمولاً زیر ${formatNumber(Math.ceil(minutes / 60), 0)} ساعت`;
}

/** کارت مشاور در فهرست: نام، آژانس، نشان‌ها، امتیاز، محله‌ها و زبان‌ها */
export function AgentCard({ agent }: { agent: AgentSummary }) {
  return (
    <article className="flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex items-start gap-4">
        <Avatar name={agent.name} />
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 font-display text-lg leading-snug text-ink">
            <Link href={`/agents/${agent.id}`} prefetch={false} className="hover:underline">
              {agent.name}
            </Link>
            {agent.isVerified && (
              <SealCheck size={18} weight="fill" className="shrink-0 text-verified" aria-label="مشاور تأییدشده" />
            )}
          </h3>
          {agent.agency && (
            <p className="truncate text-sm text-muted">
              <Link href={`/agencies/${agent.agency.slug}`} prefetch={false} className="hover:text-ink hover:underline">
                {agent.agency.name}
              </Link>
            </p>
          )}
          {agent.isTopAgent && (
            <div className="mt-2">
              <Badge kind="topAgent" />
            </div>
          )}
        </div>
      </div>
      <p className="text-sm">
        <Rating rating={agent.rating} count={agent.reviewCount} />
      </p>
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted">آگهی فعال</dt>
        <dd className="text-ink">{formatNumber(agent.activeListingCount, 0)}</dd>
        <dt className="text-muted">زبان</dt>
        <dd className="text-ink">{languageNames(agent.languages)}</dd>
      </dl>
      {agent.areas.length > 0 && (
        <p className="line-clamp-2 text-sm text-ink-2">
          {agent.areas
            .slice(0, 4)
            .map((a) => a.nameFa)
            .join('، ')}
          {agent.areas.length > 4 && ` و ${formatNumber(agent.areas.length - 4, 0)} محله‌ی دیگر`}
        </p>
      )}
    </article>
  );
}