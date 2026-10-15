import type { Metadata } from 'next';
import { MockCheckout } from './mock-checkout';

export const metadata: Metadata = { title: 'درگاه آزمایشی', robots: { index: false, follow: false } };

type Props = { params: Promise<{ orderId: string }> };

/** صفحه‌ی درگاه پرداخت ساختگی (فقط توسعه). درگاه واقعی جایگزین همین آدرس می‌شود. */
export default async function MockPayPage({ params }: Props) {
  const { orderId } = await params;
  return (
    <main id="main" className="container-page py-14 md:py-20">
      <MockCheckout orderId={orderId} />
    </main>
  );
}