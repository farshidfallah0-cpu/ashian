import { UIProvider } from '@ashian/ui';
import type { Metadata } from 'next';
import { DesignSpecimen } from './specimen';

export const metadata: Metadata = {
  title: 'سیستم دیزاین',
  robots: { index: false, follow: false },
};

export default function DesignPage() {
  // ریشه‌ی سایت provider سبک دارد؛ مستند سیستم دیزاین همه‌ی کامپوننت‌ها را نشان می‌دهد
  return (
    <UIProvider>
      <DesignSpecimen />
    </UIProvider>
  );
}
