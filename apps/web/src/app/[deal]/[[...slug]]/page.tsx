import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingSeo, landingIntro } from '../../../components/search/landing-seo';
import { ResultsPage } from '../../../components/search/results-page';
import { landingPath, landingPreset, parseLanding } from '../../../lib/landing';
import {
  buildHeading,
  fetchSearch,
  getPlaces,
  parseSearch,
  type RawParams,
} from '../../../lib/search-server';

type Props = {
  params: Promise<{ deal: string; slug?: string[] }>;
  searchParams: Promise<RawParams>;
};

/** فقط /rent و /sale (و زیرمسیرهایشان) لندینگ‌اند؛ هر چیز دیگر ۴۰۴ */
async function resolve(params: Props['params'], searchParams: Props['searchParams']) {
  const { deal, slug = [] } = await params;
  const places = await getPlaces();
  const spec = parseLanding(deal, slug, places);
  if (!spec) return null;
  const parsed = parseSearch(await searchParams, landingPreset(spec));
  return { spec, parsed, places };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const resolved = await resolve(params, searchParams);
  if (!resolved) return {};
  const { spec, parsed, places } = resolved;
  const heading = buildHeading(parsed.query, places);
  const path = landingPath(spec);
  const data = await fetchSearch(parsed.apiQs);
  const description = data
    ? landingIntro(spec, heading, data, places)
    : `${heading}؛ آگهی‌های تأییدشده با قیمت به درهم و متراژ به فوت مربع.`;
  const page = parsed.query.page;
  return {
    title: page > 1 ? `${heading} (صفحه‌ی ${page})` : heading,
    description: description.slice(0, 300),
    // ?page=N و پارامترهای دیگر به همان لندینگ canonical می‌شوند (محتوای تکراری نسازیم)
    alternates: { canonical: page > 1 ? `${path}?page=${page}` : path },
  };
}

export default async function LandingPage({ params, searchParams }: Props) {
  const resolved = await resolve(params, searchParams);
  if (!resolved) notFound();
  const { spec, parsed } = resolved;
  return (
    <ResultsPage
      parsed={parsed}
      basePath={landingPath(spec)}
      preset={landingPreset(spec)}
      seo={({ data, places, heading }) => (
        <LandingSeo spec={spec} heading={heading} data={data} places={places} />
      )}
    />
  );
}
