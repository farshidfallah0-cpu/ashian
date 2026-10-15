import { Button, cn } from '@ashian/ui';
import { formatNumber, type SearchCard } from '@ashian/shared';
import {
  ArrowLeft,
  CaretLeft,
  CaretRight,
  Calculator,
  Handshake,
  MapTrifold,
  Medal,
  Scales,
  SealCheck,
} from '@phosphor-icons/react/ssr';
import Link from 'next/link';
import { ListingCard } from '../listing-card';
import { Reveal } from '../reveal';
import { SectionHead } from './section-head';
import { Slider } from './slider';

/* ───────────── ۵. تازه‌های تأییدشده ───────────── */

export function LatestVerified({ listings }: { listings: SearchCard[] }) {
  if (listings.length === 0) return null;
  return (
    <section aria-labelledby="latest-title" className="bg-surface py-14 md:py-20">
      <div className="container-page">
        <Reveal>
          <SectionHead
            id="latest-title"
            title="تازه‌های تأییدشده"
            lead="جدیدترین آگهی‌هایی که تیم آشیان بررسی کرده است."
            href="/search?verified=1&sort=newest"
            linkLabel="مشاهده‌ی همه"
          />
        </Reveal>
        <Slider
          label="تازه‌های تأییدشده"
          previousIcon={<CaretRight size={16} aria-hidden />}
          nextIcon={<CaretLeft size={16} aria-hidden />}
        >
          {listings.map((listing) => (
            <ListingCard
              key={listing.publicId}
              listing={listing}
              className="w-[17.5rem] shrink-0 snap-start sm:w-[19rem]"
              sizes="(min-width: 640px) 304px, 280px"
            />
          ))}
        </Slider>
      </div>
    </section>
  );
}

/* ───────────── اجاره‌ها و خریدهای منتخب (شبکه‌ی ثابت، بدون اسکرول) ───────────── */

export function PicksSection({
  id,
  title,
  lead,
  listings,
  href,
  linkLabel,
  tinted = false,
}: {
  id: string;
  title: string;
  lead: string;
  listings: SearchCard[];
  href: string;
  linkLabel: string;
  tinted?: boolean;
}) {
  if (listings.length === 0) return null;
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn('py-14 md:py-20', tinted && 'bg-surface')}
    >
      <div className="container-page">
        <Reveal>
          <SectionHead
            id={`${id}-title`}
            title={title}
            lead={lead}
            href={href}
            linkLabel={linkLabel}
          />
        </Reveal>
        <Reveal>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-10 min-[560px]:grid-cols-2 lg:grid-cols-4">
            {listings.slice(0, 8).map((listing) => (
              <li key={listing.publicId}>
                <ListingCard
                  listing={listing}
                  sizes="(min-width: 1024px) 22vw, (min-width: 560px) 45vw, 92vw"
                />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── ۶. اعتماد ───────────── */

const TRUST = [
  {
    icon: SealCheck,
    title: 'آگهی تأییدشده یعنی چه؟',
    points: [
      'هویت آگهی‌دهنده و مجوز تبلیغ (Permit) آگهی بررسی شده است.',
      'عکس‌ها و متراژ با ملک واقعی می‌خواند و آگهی تکراری نیست.',
      'هر آگهی تأییدشده نشان سبز دارد و در جستجو می‌توانید فقط آن‌ها را ببینید.',
    ],
  },
  {
    icon: Medal,
    title: 'مشاور برتر کیست؟',
    points: [
      'شماره‌ی مجوز مشاور (RERA/BRN) تأیید شده است.',
      'امتیاز کاربران بالا و زمان پاسخ‌گویی کوتاه دارد.',
      'نشان «مشاور برتر» فقط بر اساس همین معیارها داده می‌شود، نه پرداخت.',
    ],
  },
] as const;

export function TrustSection() {
  return (
    <section aria-labelledby="trust-title" className="container-page py-14 md:py-20">
      <Reveal>
        <SectionHead
          id="trust-title"
          title="اعتماد، قابل بررسی"
          lead="قبل از تماس بدانید به چه چیزی نگاه می‌کنید."
        />
      </Reveal>
      <div className="grid gap-12 md:grid-cols-2 md:gap-0">
        {TRUST.map((item, i) => (
          <Reveal key={item.title} delay={i * 0.06}>
            <div
              className={cn('md:px-10', i === 0 ? 'md:ps-0 md:border-e md:border-line' : 'md:pe-0')}
            >
              <item.icon size={36} weight="light" className="text-verified" aria-hidden />
              <h3 className="mt-5 font-display text-xl text-ink">{item.title}</h3>
              <ul className="mt-4 space-y-3 text-base text-ink-2">
                {item.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-[0.8em] h-px w-4 shrink-0 bg-ink" aria-hidden />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ───────────── ۷. ابزارها ───────────── */

const TOOLS = [
  {
    icon: MapTrifold,
    title: 'نقشه‌ی قیمت',
    text: 'میانگین قیمت هر فوت مربع را روی نقشه‌ی دبی ببینید.',
    href: '/tools/price-map',
  },
  {
    icon: Scales,
    title: 'مقایسه‌ی محله‌ها',
    text: 'دو یا سه محله را از نظر قیمت، متراژ و تعداد آگهی کنار هم بگذارید.',
    href: '/tools/compare-areas',
  },
  {
    icon: Calculator,
    title: 'ماشین‌حساب',
    text: 'اجاره‌ی ماهانه با چک‌های مختلف، هزینه‌ی خرید و بازده سرمایه‌گذاری.',
    href: '/tools/calculator',
  },
] as const;

export function ToolsSection() {
  return (
    <section aria-labelledby="tools-title" className="bg-surface py-14 md:py-20">
      <div className="container-page">
        <Reveal>
          <SectionHead id="tools-title" title="ابزارهای تصمیم‌گیری" />
        </Reveal>
        <ul className="grid gap-px overflow-hidden rounded-sm bg-line md:grid-cols-3">
          {TOOLS.map((tool, i) => (
            <li key={tool.title} className="bg-bg">
              <Reveal delay={i * 0.05} className="h-full">
                <Link
                  href={tool.href}
                  className="group flex h-full flex-col gap-4 p-7 outline-offset-[-2px] transition-colors hover:bg-surface md:p-8"
                >
                  <tool.icon size={32} weight="light" className="text-brand" aria-hidden />
                  <div>
                    <h3 className="font-display text-lg text-ink">{tool.title}</h3>
                    <p className="mt-1.5 text-base text-muted">{tool.text}</p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-sm text-ink">
                    استفاده
                    <ArrowLeft
                      size={14}
                      className="transition-transform duration-200 ease-out group-hover:-translate-x-1"
                      aria-hidden
                    />
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── ۸. دعوت از مشاوران ───────────── */

export function AgentsInvite({ agents, listings }: { agents: number; listings: number }) {
  return (
    <section aria-labelledby="agents-title" className="container-page py-14 md:py-20">
      <Reveal>
        <div className="grid gap-10 rounded-sm bg-brand p-8 text-white md:grid-cols-[1.4fr_1fr] md:items-end md:gap-16 md:p-14">
          <div>
            <Handshake size={34} weight="light" aria-hidden />
            <h2 id="agents-title" className="mt-5 text-2xl text-white md:text-3xl">
              مشاور یا آژانس هستید؟
            </h2>
            <p className="mt-3 max-w-lg text-base text-white/80">
              آگهی‌های شما با نام و شماره‌ی مجوزتان دیده می‌شوند، در جستجو منصفانه نمایش داده
              می‌شوند و هیچ مشاوری صفحه را قبضه نمی‌کند. پنل مشاور، سرنخ‌ها و پیام‌ها یک‌جاست.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Button asChild variant="primary" size="lg">
                <Link href="/agents/join">پیوستن به آشیان</Link>
              </Button>
              <Link
                href="/agents"
                className="text-base text-white underline decoration-white/40 underline-offset-[6px] hover:decoration-white"
              >
                مشاوران فعال
              </Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-6 border-t border-white/20 pt-6 md:border-s md:border-t-0 md:ps-10 md:pt-0">
            <div>
              <dd className="font-sans text-3xl font-bold text-white">{formatNumber(agents, 0)}</dd>
              <dt className="text-sm text-white/70">مشاور فعال</dt>
            </div>
            <div>
              <dd className="font-sans text-3xl font-bold text-white">
                {formatNumber(listings, 0)}
              </dd>
              <dt className="text-sm text-white/70">آگهی فعال</dt>
            </div>
          </dl>
        </div>
      </Reveal>
    </section>
  );
}
