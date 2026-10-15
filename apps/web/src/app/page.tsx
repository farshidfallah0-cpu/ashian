import { formatNumber, type HomeResponse } from '@ashian/shared';
import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { Hero, type HeroChip } from '../components/home/hero';
import { SearchBox, type PopularPlace } from '../components/home/search-box';
import {
  AgentsInvite,
  LatestVerified,
  PicksSection,
  ToolsSection,
  TrustSection,
} from '../components/home/sections';
import { CommunityMosaic, PropertyTypeStrip } from '../components/home/showcase';
import { apiGet } from '../lib/api';

/** ISR: صفحه استاتیک است و حداکثر هر ۵ دقیقه یک بار پشت‌صحنه تازه می‌شود */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: 'آشیان | اجاره و خرید ملک در دبی' },
  description:
    'آگهی‌های تأییدشده‌ی اجاره و خرید ملک در دبی برای فارسی‌زبانان؛ قیمت به درهم، متراژ به فوت مربع، با تاریخ انتشار و مشاور هر آگهی.',
  alternates: { canonical: '/' },
};

const EMPTY: HomeResponse = {
  stats: { listings: 0, communities: 0, agents: 0 },
  propertyTypes: { rent: [], sale: [] },
  communities: [],
  latestVerified: [],
  rentPicks: [],
  salePicks: [],
  generatedAt: '',
};

/** جستجوهای پرتکرار زیر تیتر؛ یکی از آن‌ها از داده‌ی واقعی (پرآگهی‌ترین محله) ساخته می‌شود */
function heroChips(home: HomeResponse): HeroChip[] {
  const top = home.communities[0];
  const chips: HeroChip[] = [
    { label: 'استودیو برای اجاره', href: '/search?dealType=rent&bedroomsMax=0' },
    {
      label: 'آپارتمان یک‌خوابه برای اجاره',
      href: '/search?dealType=rent&propertyType=apartment&bedroomsMin=1&bedroomsMax=1',
    },
    { label: 'ویلا برای خرید', href: '/search?dealType=sale&propertyType=villa' },
    { label: 'پنت‌هاوس', href: '/search?propertyType=penthouse' },
    { label: 'فقط آگهی‌های تأییدشده', href: '/search?verified=1' },
  ];
  if (top) {
    chips.splice(2, 0, {
      label: `اجاره در ${top.nameFa}`,
      href: `/search?dealType=rent&location=${encodeURIComponent(top.path)}`,
    });
  }
  return chips;
}

export default async function HomePage() {
  const home = (await apiGet<HomeResponse>('/v1/home', { revalidate })) ?? EMPTY;
  const popular: PopularPlace[] = home.communities.map((c) => ({
    path: c.path,
    label: c.nameFa,
    hint: c.nameEn,
    count: c.listingCount,
  }));
  const marina = home.communities.find((c) => c.slug === 'dubai-marina');

  return (
    <main id="main">
      <Hero
        chips={heroChips(home)}
        spotlight={
          marina
            ? {
                name: marina.nameFa,
                count: marina.listingCount,
                href: `/search?location=${encodeURIComponent(marina.path)}`,
              }
            : null
        }
      />

      {/* جستجو روی لبه‌ی پایین هیرو می‌نشیند */}
      <div className="container-page relative z-10 -mt-20 md:-mt-24">
        <SearchBox
          popular={popular}
          icons={{
            search: <MagnifyingGlass size={18} weight="bold" aria-hidden />,
            caret: <CaretDown size={16} aria-hidden />,
            clear: <X size={14} weight="bold" aria-hidden />,
          }}
        />
        {home.stats.listings > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-2 text-sm text-muted">
            <div className="flex items-baseline gap-2">
              <dd className="font-sans text-lg font-bold text-ink">
                {formatNumber(home.stats.listings, 0)}
              </dd>
              <dt>آگهی فعال</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-sans text-lg font-bold text-ink">
                {formatNumber(home.stats.communities, 0)}
              </dd>
              <dt>محله</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-sans text-lg font-bold text-ink">
                {formatNumber(home.stats.agents, 0)}
              </dd>
              <dt>مشاور فعال</dt>
            </div>
          </dl>
        )}
      </div>

      <PropertyTypeStrip rent={home.propertyTypes.rent} sale={home.propertyTypes.sale} />
      <CommunityMosaic communities={home.communities} totalCommunities={home.stats.communities} />
      <LatestVerified listings={home.latestVerified} />
      <PicksSection
        id="rent-picks"
        title="اجاره‌های منتخب"
        lead="بر اساس کیفیت آگهی (عکس، اطلاعات کامل، تأییدشدن) و تازگی."
        listings={home.rentPicks}
        href="/search?dealType=rent&sort=relevance"
        linkLabel="همه‌ی اجاره‌ها"
      />
      <PicksSection
        id="sale-picks"
        title="خریدهای منتخب"
        lead="همان معیارها، برای آگهی‌های فروش."
        listings={home.salePicks}
        href="/search?dealType=sale&sort=relevance"
        linkLabel="همه‌ی آگهی‌های فروش"
        tinted
      />
      <TrustSection />
      <ToolsSection />
      <AgentsInvite agents={home.stats.agents} listings={home.stats.listings} />
    </main>
  );
}
