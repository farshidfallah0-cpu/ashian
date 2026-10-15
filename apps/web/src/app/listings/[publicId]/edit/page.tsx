import type { Metadata } from 'next';
import { Wizard } from '../../../../components/wizard/wizard';

export const metadata: Metadata = {
  title: 'ویرایش آگهی',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ publicId: string }> };

export default async function EditListingPage({ params }: Props) {
  const { publicId } = await params;
  return (
    <main id="main" className="container-page py-8 md:py-12">
      <Wizard editId={publicId} />
    </main>
  );
}