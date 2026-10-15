import { countActiveFilters } from '../../lib/search-url';
import { buildHeading, getPlaces, parseSearch, type RawParams } from '../../lib/search-server';
import { ResultsPage } from '../../components/search/results-page';
import type { Metadata } from 'next';

type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const parsed = parseSearch(await searchParams);
  const heading = buildHeading(parsed.query, await getPlaces());
  // نتیجه‌ی فیلترهای دلخواه و صفحه‌های بعدی ایندکس نمی‌شوند؛ ترکیب‌های پرتکرار لندینگ اختصاصی دارند (/rent/...)
  const indexable = countActiveFilters(parsed.apiQs) === 0 && parsed.query.page === 1;
  return {
    title: heading,
    description: `${heading}؛ آگهی‌های تأییدشده با قیمت به درهم، متراژ به فوت مربع، تاریخ انتشار و مشاور هر آگهی.`,
    alternates: { canonical: '/search' },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const parsed = parseSearch(await searchParams);
  return <ResultsPage parsed={parsed} basePath="/search" />;
}
