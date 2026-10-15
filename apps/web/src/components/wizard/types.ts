import type { ListingDetail } from '@ashian/shared';
import type { Draft, StepId } from '../../lib/wizard';

/** هشدار «داده‌ی غیرعادی» که API برمی‌گرداند (همان QualityWarning) */
export interface Warning {
  field: string;
  code: string;
  message: string;
}

/** ورودی مشترک همه‌ی مرحله‌های ویزارد */
export interface StepProps {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  /** خطای هر فیلد از سرور */
  errors: Record<string, string>;
  /** بعد از زدن «ادامه» روی مرحله‌ی ناقص، خطاها و فیلدهای خالی نشان داده می‌شوند */
  showErrors: boolean;
  warnings: Warning[];
  /** وضعیت آگهی روی سرور (خالی = هنوز پیش‌نویس ساخته نشده) */
  status: ListingDetail['status'] | null;
  editing: boolean;
  goTo: (step: StepId) => void;
}
