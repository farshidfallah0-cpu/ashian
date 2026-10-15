import { formatDate, formatNumber } from '@ashian/shared';
import type { DashboardSeriesPoint } from '@ashian/shared';
import type { ReactNode } from 'react';

/** عدد شاخص با برچسب (داشبورد) */
export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-bg p-5 md:p-6">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-display text-3xl text-ink">{value}</dd>
      {sub && <dd className="mt-0.5 text-sm text-muted">{sub}</dd>}
    </div>
  );
}

/**
 * نمودار روزانه‌ی بازدید (ستون) و سرنخ (نقطه‌ی نارنجی)، سروری و بدون کتابخانه.
 * ستون‌ها با flex و ارتفاع درصدی رسم می‌شوند تا متن در هر عرضی خوانا بماند؛ جدول متنی برای صفحه‌خوان‌ها هست.
 * راست‌به‌چپ: قدیمی‌ترین روز سمت راست.
 */
export function DailyChart({ series }: { series: DashboardSeriesPoint[] }) {
  if (series.length === 0) return <p className="text-base text-muted">هنوز آمار نمایشی وجود ندارد.</p>;
  const maxViews = Math.max(1, ...series.map((p) => p.views));
  const maxLeads = Math.max(1, ...series.map((p) => p.leads));
  const empty = series.every((p) => p.views === 0 && p.leads === 0);
  const mid = series[Math.floor(series.length / 2)]!;

  return (
    <figure>
      <div className="relative">
        <div className="flex h-44 items-end gap-[3px] border-b border-line" role="img" aria-label="نمودار بازدید و سرنخ روزانه">
          {series.map((p) => (
            <div
              key={p.day}
              title={`${formatDate(p.day, 'short')}: ${formatNumber(p.views, 0)} بازدید، ${formatNumber(p.leads, 0)} سرنخ`}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-[2px] bg-brand-soft transition-colors group-hover:bg-brand/30"
                style={{ height: `${Math.max(p.views > 0 ? 3 : 0, (p.views / maxViews) * 100)}%` }}
              />
              {p.leads > 0 && (
                <span
                  className="absolute inset-x-0 mx-auto size-2.5 rounded-full border-2 border-bg bg-accent"
                  style={{ bottom: `calc(${(p.leads / maxLeads) * 82}% + 6px)` }}
                />
              )}
            </div>
          ))}
        </div>
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-base text-muted">
            هنوز بازدید یا سرنخی در این بازه ثبت نشده است.
          </p>
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden>
        <span>{formatDate(series[0]!.day, 'short')}</span>
        <span>{formatDate(mid.day, 'short')}</span>
        <span>{formatDate(series[series.length - 1]!.day, 'short')}</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-[2px] bg-brand-soft ring-1 ring-brand/20" aria-hidden /> بازدید
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-accent" aria-hidden /> سرنخ
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>بازدید و سرنخ روزانه</caption>
        <thead>
          <tr>
            <th>روز</th>
            <th>بازدید</th>
            <th>سرنخ</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.day}>
              <td>{p.day}</td>
              <td>{p.views}</td>
              <td>{p.leads}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** میله‌های افقی ساده (تفکیک نوع سرنخ) */
export function HBars({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between text-base">
            <span className="text-ink-2">{item.label}</span>
            <span className="text-ink">{formatNumber(item.value, 0)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}