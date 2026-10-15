import { isPublicId } from '@ashian/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AgentCard, MobileContactBar } from '../../../components/listing/agent-card';
import { Breadcrumbs } from '../../../components/listing/breadcrumbs';
import { Calculator } from '../../../components/listing/calculator';
import { ContactRoot } from '../../../components/listing/contact';
import { Gallery } from '../../../components/listing/gallery';
import { ListingHeader } from '../../../components/listing/header';
import { LocationSection } from '../../../components/listing/location';
import { NeighborhoodSection } from '../../../components/listing/neighborhood';
import { PriceHistory } from '../../../components/listing/price-history';
import { RelatedListings } from '../../../components/listing/related';
import {
  Amenities,
  Description,
  DetailsTable,
  KeySpecs,
  Section,
} from '../../../components/listing/sections';
import { ViewBeacon } from '../../../components/listing/view-beacon';
import {
  getAgentListings,
  getListing,
  getNearby,
  getNeighborhood,
  getSimilar,
} from '../../../lib/listing';
import { communityHref, listingJsonLd, listingMetadata, placeName } from '../../../lib/listing-seo';

type Props = { params: Promise<{ publicId: string }> };

/**
 * ISR: صفحه‌ی هر آگهی ۶۰ ثانیه کش می‌شود و پس از آن در پس‌زمینه بازسازی می‌شود. هرچه مخصوص کاربر است
 * (قلب، شمارش بازدید، دکمه‌های تماس) سمت کلاینت و از API گرفته می‌شود تا کش مشترک بماند.
 */
export const revalidate = 60;

/** هیچ آگهی‌ای در build ساخته نمی‌شود؛ هر آگهی در اولین بازدید ساخته و سپس کش ISR می‌شود */
export function generateStaticParams() {
  return [];
}

const notFoundMetadata: Metadata = {
  title: 'آگهی پیدا نشد',
  robots: { index: false, follow: true },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  if (!isPublicId(publicId)) return notFoundMetadata;
  const result = await getListing(publicId);
  if (!result.ok || result.data.status !== 'active') return notFoundMetadata;
  return listingMetadata(result.data);
}

export default async function ListingPage({ params }: Props) {
  const { publicId } = await params;
  if (!isPublicId(publicId)) notFound();

  const result = await getListing(publicId);
  if (!result.ok || result.data.status !== 'active') notFound();
  const listing = result.data;

  // بخش‌های تکمیلی هم‌زمان گرفته می‌شوند؛ هرکدام شکست بخورد فقط همان بخش حذف می‌شود
  const [neighborhood, nearby, similar, fromAgent] = await Promise.all([
    getNeighborhood(publicId),
    getNearby(publicId),
    getSimilar(publicId),
    getAgentListings(publicId),
  ]);
  const similarIds = new Set(similar.map((s) => s.publicId));
  const agentOthers = fromAgent.filter((a) => !similarIds.has(a.publicId));
  const agentName = listing.agent?.name ?? 'مالک ملک';

  const jsonLd = JSON.stringify(listingJsonLd(listing)).replace(/</g, '\\u003c');

  return (
    <ContactRoot
      publicId={listing.publicId}
      title={listing.title}
      code={listing.code}
      agentName={agentName}
    >
      <main id="main" className="pb-28 lg:pb-0">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        <ViewBeacon publicId={listing.publicId} />

        <div className="container-page pt-5">
          <Breadcrumbs listing={listing} />
          <div className="mt-4">
            <Gallery listing={listing} />
          </div>
        </div>

        <div className="container-page mt-10 grid gap-x-14 gap-y-12 pb-14 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            <ListingHeader listing={listing} />

            <div className="mt-10">
              <KeySpecs listing={listing} />
            </div>

            <div className="mt-12">
              {listing.description.trim() && (
                <Section id="description" title="درباره‌ی این ملک">
                  <Description text={listing.description} />
                </Section>
              )}
              <Section id="details" title="مشخصات">
                <DetailsTable listing={listing} />
              </Section>
              {listing.amenities.length > 0 && (
                <Section id="amenities" title="امکانات">
                  <Amenities items={listing.amenities} />
                </Section>
              )}
              <Section
                id="location"
                title="موقعیت و اطراف"
                lead="نزدیک‌ترین مترو، مدرسه، بیمارستان و مرکز خرید."
              >
                <LocationSection listing={listing} nearby={nearby} />
              </Section>
              <Section id="price-history" title="تاریخچه‌ی قیمت">
                <PriceHistory listing={listing} />
              </Section>
              {neighborhood && neighborhood.all.count >= 3 && (
                <Section
                  id="neighborhood"
                  title={`اطلاعات محله‌ی ${neighborhood.community.nameFa}`}
                  lead="قیمت این آگهی در مقایسه با بازار همین محله."
                >
                  <NeighborhoodSection listing={listing} stats={neighborhood} />
                </Section>
              )}
              <Section id="calculator" title="ماشین‌حساب">
                <Calculator
                  dealType={listing.dealType}
                  price={listing.price}
                  rentCheques={listing.rentCheques}
                  deposit={listing.deposit}
                />
              </Section>
            </div>
          </div>

          <aside id="contact" aria-label="تماس با آگهی‌دهنده" className="hidden lg:block">
            <div className="sticky top-24">
              <AgentCard listing={listing} />
            </div>
          </aside>
        </div>

        <RelatedListings
          id="similar"
          title="آگهی‌های مشابه"
          lead={`ملک‌های هم‌رده در ${placeName(listing)} و اطراف.`}
          listings={similar}
          href={communityHref(listing)}
          linkLabel={`همه‌ی آگهی‌های ${listing.community.nameFa}`}
        />
        <RelatedListings
          id="agent-listings"
          title={`آگهی‌های دیگر ${agentName}`}
          listings={agentOthers}
          href={listing.agent ? `/search?agentId=${listing.agent.id}` : undefined}
          linkLabel="همه‌ی آگهی‌های این مشاور"
        />
      </main>
      <MobileContactBar listing={listing} />
    </ContactRoot>
  );
}
