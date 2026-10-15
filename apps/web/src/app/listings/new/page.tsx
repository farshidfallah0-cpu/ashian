import type { Metadata } from 'next';
import { Wizard } from '../../../components/wizard/wizard';

export const metadata: Metadata = {
  title: 'ثبت آگهی',
  robots: { index: false, follow: false },
};

export default function NewListingPage() {
  return (
    <main id="main" className="container-page py-8 md:py-12">
      <Wizard />
    </main>
  );
}