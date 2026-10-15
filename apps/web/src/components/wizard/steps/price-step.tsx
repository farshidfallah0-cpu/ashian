'use client';

import { formatCheques, formatPrice, MARKET } from '@ashian/shared';
import type { DealType } from '@ashian/shared';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../../lib/client-api';
import { faNumber, parseNumberInput } from '../../../lib/wizard';
import { inputClass, StepHead, WarningBox } from '../ui';
import type { StepProps } from '../types';

interface Market {
  community: { nameFa: string };
  all: { count: number; avgPrice: number; medianPrice: number; avgPricePerSqft: number };
  sameBedrooms: { count: number; avgPrice: number; medianPrice: number } | null;
}

const COPY: Record<DealType, { label: string; hint: string; unit: string }> = {
  rent: { label: 'اجاره‌ی سالانه', hint: 'مبلغ یک سال اجاره', unit: 'درهم / سال' },
  sale: { label: 'قیمت فروش', hint: 'قیمت کل ملک', unit: 'درهم' },
  full_mortgage: { label: 'مبلغ رهن کامل', hint: 'کل مبلغ رهن', unit: 'درهم' },
  short_term: { label: 'قیمت هر شب', hint: 'اجاره‌ی یک شب', unit: 'درهم / شب' },
};

function MoneyInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
}) {
  // متن خام را نگه می‌داریم تا تایپ نیمه‌کاره (و ارقام فارسی) به‌هم نریزد
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <input
      id={id}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNumberInput(e.target.value));
      }}
      onBlur={() => value !== null && setText(String(value))}
      inputMode="numeric"
      dir="ltr"
      aria-invalid={invalid ? true : undefined}
      className={`${inputClass} h-12 text-start text-lg`}
    />
  );
}

export default function PriceStep({ draft, update, errors, showErrors, warnings }: StepProps) {
  const deal = draft.dealType ?? 'rent';
  const copy = COPY[deal];
  const [market, setMarket] = useState<Market | null>(null);

  // راهنمای قیمت: میانگین محله برای همین معامله و تعداد خواب
  useEffect(() => {
    if (!draft.locationId || !draft.dealType || draft.bedrooms === null) return;
    let alive = true;
    const qs = new URLSearchParams({
      locationId: draft.locationId,
      dealType: draft.dealType,
      bedrooms: String(draft.bedrooms),
    });
    apiRequest(`/v1/listings/market?${qs}`).then(async (response) => {
      if (alive && response?.ok) setMarket((await response.json()) as Market);
    });
    return () => {
      alive = false;
    };
  }, [draft.locationId, draft.dealType, draft.bedrooms]);

  const reference = market?.sameBedrooms ?? (market && market.all.count >= 3 ? market.all : null);
  const priceError = errors.price ?? (showErrors && draft.price === null ? 'قیمت را وارد کنید.' : null);
  const priceWarnings = warnings.filter((w) => w.field === 'price').map((w) => w.message);

  const position =
    reference && draft.price
      ? Math.max(4, Math.min(96, (draft.price / (reference.avgPrice * 2)) * 100))
      : null;

  return (
    <div className="grid gap-9">
      <StepHead
        title="قیمت"
        lead="قیمت واقع‌بینانه سریع‌تر تماس می‌آورد. میانگین بازار همین محله را کنار فرم می‌بینید."
      />

      <div>
        <label htmlFor="price" className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink">
          <span>{copy.label}</span>
          <span className="font-normal text-muted">{copy.unit}</span>
        </label>
        <MoneyInput
          id="price"
          value={draft.price}
          onChange={(price) => update({ price })}
          invalid={!!priceError}
        />
        {draft.price ? (
          <p className="mt-1.5 text-base text-ink">{formatPrice(draft.price)}</p>
        ) : (
          <p className="mt-1.5 text-sm text-muted">{copy.hint}</p>
        )}
        {priceError && (
          <p role="alert" className="mt-1.5 text-sm text-danger">
            {priceError}
          </p>
        )}
      </div>

      {reference && (
        <aside aria-label="میانگین بازار" className="rounded-sm bg-surface p-5">
          <p className="text-sm text-muted">
            بازار {market!.community.nameFa}
            {market!.sameBedrooms
              ? ` · هم‌تعداد خواب (${faNumber.format(market!.sameBedrooms.count)} آگهی فعال)`
              : ` · همه‌ی آگهی‌ها (${faNumber.format(market!.all.count)} آگهی فعال)`}
          </p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-1">
            <p>
              <span className="text-sm text-muted">میانگین </span>
              <span className="font-display text-xl text-ink">{formatPrice(reference.avgPrice)}</span>
            </p>
            <p>
              <span className="text-sm text-muted">میانه </span>
              <span className="text-base text-ink-2">{formatPrice(reference.medianPrice)}</span>
            </p>
          </div>
          {position !== null && (
            <div className="mt-4" aria-hidden>
              <div className="relative h-1.5 rounded-full bg-line">
                <span className="absolute inset-y-0 start-1/2 w-px bg-ink" />
                <span
                  className="absolute top-1/2 size-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-bg bg-accent"
                  style={{ insetInlineStart: `${position}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-muted">
                <span>ارزان‌تر</span>
                <span>میانگین</span>
                <span>گران‌تر</span>
              </div>
            </div>
          )}
          {deal === 'sale' && market && market.all.avgPricePerSqft > 0 && draft.areaSqft && draft.price ? (
            <p className="mt-3 text-sm text-ink-2">
              قیمت هر فوت مربع شما: {formatPrice(Math.round(draft.price / draft.areaSqft), { compact: false })}
              {' · '}میانگین محله: {formatPrice(market.all.avgPricePerSqft, { compact: false })}
            </p>
          ) : null}
        </aside>
      )}

      <WarningBox messages={priceWarnings} />

      {deal === 'rent' && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">چک‌های پذیرفته‌شده</legend>
            <div className="flex flex-wrap gap-2">
              {MARKET.rent.chequeOptions.map((n) => {
                const on = draft.rentCheques.includes(n);
                return (
                  <label
                    key={n}
                    className={`flex h-11 cursor-pointer items-center rounded-sm border px-4 text-base transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                      on ? 'border-ink bg-surface text-ink' : 'border-line-strong text-ink-2 hover:border-ink'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        update({
                          rentCheques: on
                            ? draft.rentCheques.filter((c) => c !== n)
                            : [...draft.rentCheques, n].sort((a, b) => a - b),
                        })
                      }
                      className="sr-only"
                    />
                    {formatCheques(n)}
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-sm text-muted">اگر هیچ‌کدام را انتخاب نکنید، «توافقی» حساب می‌شود.</p>
          </fieldset>
          <div>
            <label htmlFor="deposit" className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink">
              <span>ودیعه (اختیاری)</span>
              <span className="font-normal text-muted">درهم</span>
            </label>
            <MoneyInput id="deposit" value={draft.deposit} onChange={(deposit) => update({ deposit })} />
            {errors.deposit && (
              <p role="alert" className="mt-1.5 text-sm text-danger">
                {errors.deposit}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}