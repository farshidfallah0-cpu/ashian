import { Badge } from '@ashian/ui';
import { formatNumber, type ListingDetail } from '@ashian/shared';
import {
  CalendarCheck,
  ChatCircleDots,
  Phone,
  SealCheck,
  Star,
  WhatsappLogo,
} from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { ContactButton } from './contact';

function Initial({ name, size }: { name: string; size: 'sm' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-brand ${
        size === 'lg' ? 'size-16 text-2xl' : 'size-10 text-base'
      }`}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

function responseText(minutes: number): string {
  if (minutes < 60) return `پاسخ معمولاً زیر ${formatNumber(Math.ceil(minutes / 5) * 5, 0)} دقیقه`;
  return `پاسخ معمولاً زیر ${formatNumber(Math.ceil(minutes / 60), 0)} ساعت`;
}

/**
 * کارت مشاور: در دسکتاپ کنار صفحه و چسبان. تماس و واتساپ هر کدام یک lead ثبت می‌کنند و
 * شماره فقط در پاسخ همان درخواست می‌آید. آگهی بدون مشاور مال مالک مستقیم است.
 */
export function AgentCard({ listing }: { listing: ListingDetail }) {
  const agent = listing.agent;
  const name = agent?.name ?? 'مالک ملک';

  return (
    <div className="rounded-sm border border-line bg-bg p-6">
      <div className="flex items-start gap-4">
        <Initial name={name} size="lg" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-display text-lg leading-snug text-ink">
            {agent ? (
              <Link href={`/agents/${agent.id}`} prefetch={false} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
            {agent?.isVerified && (
              <SealCheck
                size={18}
                weight="fill"
                className="shrink-0 text-verified"
                aria-label="مشاور تأییدشده"
              />
            )}
          </p>
          {agent?.agency && (
            <p className="mt-0.5 truncate text-sm text-muted">
              <Link
                href={`/agencies/${agent.agency.slug}`}
                prefetch={false}
                className="hover:text-ink hover:underline"
              >
                {agent.agency.name}
              </Link>
            </p>
          )}
          {agent?.isTopAgent && (
            <div className="mt-2">
              <Badge kind="topAgent" />
            </div>
          )}
        </div>
      </div>

      {agent && (
        <dl className="mt-5 grid grid-cols-2 gap-y-3 border-t border-line pt-4 text-sm">
          {agent.rating !== null && agent.reviewCount > 0 && (
            <div>
              <dt className="sr-only">امتیاز</dt>
              <dd className="flex items-center gap-1 text-ink">
                <Star size={16} weight="fill" className="text-ink" aria-hidden />
                <span className="font-bold">{formatNumber(agent.rating, 1)}</span>
                <span className="text-muted">({formatNumber(agent.reviewCount, 0)} نظر)</span>
              </dd>
            </div>
          )}
          <div>
            <dt className="sr-only">آگهی فعال</dt>
            <dd className="text-ink-2">{formatNumber(agent.activeListingCount, 0)} آگهی فعال</dd>
          </div>
          {agent.avgResponseMinutes !== null && (
            <div className="col-span-2">
              <dt className="sr-only">زمان پاسخ</dt>
              <dd className="text-ink-2">{responseText(agent.avgResponseMinutes)}</dd>
            </div>
          )}
          {agent.languages.length > 0 && (
            <div className="col-span-2">
              <dt className="sr-only">زبان‌ها</dt>
              <dd className="text-muted">{agent.languages.join('، ')}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-6 grid gap-2.5">
        <ContactButton action="call" style="primary" icon={<Phone size={20} aria-hidden />}>
          تماس
        </ContactButton>
        <div className="grid grid-cols-2 gap-2.5">
          <ContactButton
            action="whatsapp"
            style="secondary"
            icon={<WhatsappLogo size={20} aria-hidden />}
          >
            واتساپ
          </ContactButton>
          <ContactButton
            action="message"
            style="secondary"
            icon={<ChatCircleDots size={20} aria-hidden />}
          >
            پیام
          </ContactButton>
        </div>
        <ContactButton
          action="visit_request"
          style="text"
          icon={<CalendarCheck size={18} aria-hidden />}
          className="justify-self-center pt-1"
        >
          درخواست بازدید
        </ContactButton>
      </div>

      {!listing.isVerified && (
        <p className="mt-5 border-t border-line pt-4 text-xs leading-6 text-muted">
          هرگز پیش از دیدن ملک و بررسی قرارداد، وجهی پرداخت نکنید. مجوز تبلیغ (Permit) را از
          مشاور بخواهید.
        </p>
      )}
    </div>
  );
}

/** نوار تماس ثابت پایین صفحه در موبایل */
export function MobileContactBar({ listing }: { listing: ListingDetail }) {
  const name = listing.agent?.name ?? 'مالک ملک';
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-sheet lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Initial name={name} size="sm" />
          <div className="min-w-0 text-xs">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-muted">
              {listing.agent?.agency?.name ?? 'آگهی‌دهنده'}
            </p>
          </div>
        </div>
        <ContactButton
          action="message"
          style="barSecondary"
          icon={<ChatCircleDots size={20} aria-hidden />}
          className="px-0! size-11"
        >
          <span className="sr-only">پیام</span>
        </ContactButton>
        <ContactButton
          action="whatsapp"
          style="barSecondary"
          icon={<WhatsappLogo size={20} aria-hidden />}
          className="px-0! size-11"
        >
          <span className="sr-only">واتساپ</span>
        </ContactButton>
        <ContactButton action="call" style="barPrimary" icon={<Phone size={20} aria-hidden />}>
          تماس
        </ContactButton>
      </div>
    </div>
  );
}
