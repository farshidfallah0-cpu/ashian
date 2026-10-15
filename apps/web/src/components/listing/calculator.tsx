'use client';

import {
  MARKET,
  formatCheques,
  formatNumber,
  formatPrice,
  parseNumber,
  type DealType,
} from '@ashian/shared';
import { controlClass } from '@ashian/ui';
import { useId, useState, type ReactNode } from 'react';

interface Props {
  dealType: DealType;
  price: number;
  /** فقط اجاره: چک‌های پذیرفته‌شده (خالی = همه) */
  rentCheques: number[];
  deposit: number | null;
}

/** هزینه‌های جانبی خرید در دبی (برآورد معمول بازار) */
const TRANSFER_FEE = 0.04;
const AGENT_FEE = 0.02;

const PANEL = 'rounded-sm bg-surface p-6 md:p-7';
const LABEL = 'mb-1.5 flex items-baseline justify-between gap-3 text-sm text-ink';

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        <span>{label}</span>
        <span className="font-bold">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-brand"
      />
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        <span>{label}</span>
        <span className="text-muted">درهم</span>
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        dir="ltr"
        className={`${controlClass} text-start`}
      />
    </div>
  );
}

function Result({ label, value, big }: { label: string; value: ReactNode; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="text-base text-muted">{label}</dt>
      <dd className={big ? 'font-display text-2xl text-ink' : 'text-base text-ink'}>{value}</dd>
    </div>
  );
}

/* ───────────── فروش: وام مسکن ───────────── */

function MortgageCalculator({ price }: { price: number }) {
  const [down, setDown] = useState(20);
  const [rate, setRate] = useState(4.5);
  const [years, setYears] = useState(25);

  const loan = Math.round(price * (1 - down / 100));
  const months = years * 12;
  const monthlyRate = rate / 100 / 12;
  const monthly =
    monthlyRate === 0
      ? loan / months
      : (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const interest = monthly * months - loan;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="grid content-start gap-6">
        <Slider
          label="پیش‌پرداخت"
          value={down}
          min={20}
          max={80}
          step={5}
          display={`${formatNumber(down, 0)}٪ · ${formatPrice(price * (down / 100))}`}
          onChange={setDown}
        />
        <Slider
          label="نرخ سود سالانه"
          value={rate}
          min={2}
          max={8}
          step={0.25}
          display={`${formatNumber(rate, 2)}٪`}
          onChange={setRate}
        />
        <Slider
          label="مدت وام"
          value={years}
          min={5}
          max={25}
          step={1}
          display={`${formatNumber(years, 0)} سال`}
          onChange={setYears}
        />
      </div>

      <div className={PANEL}>
        <dl aria-live="polite">
          <Result label="قسط ماهانه" value={formatPrice(monthly)} big />
          <Result label="مبلغ وام" value={formatPrice(loan)} />
          <Result label="مجموع سود" value={formatPrice(interest)} />
          <Result label="هزینه‌ی انتقال سند (۴٪)" value={formatPrice(price * TRANSFER_FEE)} />
          <Result label="کمیسیون مشاور (۲٪)" value={formatPrice(price * AGENT_FEE)} />
        </dl>
        <p className="mt-4 text-xs leading-6 text-muted">
          برآورد تقریبی با قسط ثابت است. شرایط وام (حداقل پیش‌پرداخت، سقف مدت و نرخ) به بانک و وضعیت
          خریدار بستگی دارد؛ پیش از تصمیم با بانک و مشاور تأیید کنید.
        </p>
      </div>
    </div>
  );
}

/* ───────────── اجاره: چک‌ها + تبدیل رهن و اجاره ───────────── */

function RentCalculator({
  price,
  rentCheques,
  deposit,
}: {
  price: number;
  rentCheques: number[];
  deposit: number | null;
}) {
  const [depositText, setDepositText] = useState(deposit ? String(deposit) : '');
  const [rate, setRate] = useState(8);

  const depositValue = Math.max(0, parseNumber(depositText) ?? 0);
  const adjusted = Math.max(0, price - depositValue * (rate / 100));
  const options = MARKET.rent.chequeOptions;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-3 font-sans text-base font-bold text-ink">مبلغ هر چک</h3>
        <ul className="divide-y divide-line border-y border-line">
          {options.map((n) => {
            const accepted = rentCheques.length === 0 || rentCheques.includes(n);
            return (
              <li
                key={n}
                className={`flex items-baseline justify-between gap-4 py-3 text-base ${
                  accepted ? 'text-ink' : 'text-faint'
                }`}
              >
                <span>
                  {formatCheques(n)}
                  {!accepted && <span className="ms-2 text-xs">(مورد قبول نیست)</span>}
                </span>
                <span>{formatPrice(price / n)}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-sm text-muted">
          اجاره‌ی ماهانه‌ی معادل: {formatPrice(price / 12)}
        </p>
      </div>

      <div className={PANEL}>
        <h3 className="mb-1 font-sans text-base font-bold text-ink">تبدیل رهن و اجاره</h3>
        <p className="mb-5 text-sm text-muted">
          برای مذاکره: اگر بخشی از مبلغ را به‌صورت رهن بدهید، اجاره‌ی سالانه چقدر می‌شود؟
        </p>
        <div className="grid gap-5">
          <MoneyField label="مبلغ رهن" value={depositText} onChange={setDepositText} />
          <Slider
            label="نرخ تبدیل سالانه"
            value={rate}
            min={4}
            max={15}
            step={0.5}
            display={`${formatNumber(rate, 1)}٪`}
            onChange={setRate}
          />
        </div>
        <dl className="mt-5" aria-live="polite">
          <Result label="اجاره‌ی سالانه با این رهن" value={formatPrice(adjusted)} big />
          <Result label="اجاره‌ی ماهانه" value={formatPrice(adjusted / 12)} />
          <Result label="رهن کامل معادل" value={formatPrice(price / (rate / 100))} />
        </dl>
      </div>
    </div>
  );
}

/* ───────────── رهن کامل ───────────── */

function MortgageToRentCalculator({ price }: { price: number }) {
  const [rate, setRate] = useState(8);
  const yearly = price * (rate / 100);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="grid content-start gap-6">
        <p className="text-base text-ink-2">
          معادل اجاره‌ی این رهن کامل را با نرخ تبدیل دلخواه ببینید؛ برای مقایسه با آگهی‌های اجاره.
        </p>
        <Slider
          label="نرخ تبدیل سالانه"
          value={rate}
          min={4}
          max={15}
          step={0.5}
          display={`${formatNumber(rate, 1)}٪`}
          onChange={setRate}
        />
      </div>
      <div className={PANEL}>
        <dl aria-live="polite">
          <Result label="اجاره‌ی سالانه‌ی معادل" value={formatPrice(yearly)} big />
          <Result label="اجاره‌ی ماهانه‌ی معادل" value={formatPrice(yearly / 12)} />
        </dl>
      </div>
    </div>
  );
}

/* ───────────── کوتاه‌مدت ───────────── */

function ShortTermCalculator({ price }: { price: number }) {
  const [nights, setNights] = useState(7);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="grid content-start gap-6">
        <Slider
          label="تعداد شب"
          value={nights}
          min={1}
          max={60}
          step={1}
          display={`${formatNumber(nights, 0)} شب`}
          onChange={setNights}
        />
      </div>
      <div className={PANEL}>
        <dl aria-live="polite">
          <Result label="مجموع اجاره" value={formatPrice(price * nights)} big />
          <Result label="میانگین هر شب" value={formatPrice(price)} />
        </dl>
        <p className="mt-4 text-xs leading-6 text-muted">
          هزینه‌ی نظافت، ودیعه و مالیات توسط آگهی‌دهنده اعلام می‌شود.
        </p>
      </div>
    </div>
  );
}

/**
 * ماشین‌حساب مخصوص نوع معامله: فروش ← وام مسکن و هزینه‌های خرید؛ اجاره ← مبلغ چک‌ها و تبدیل رهن و اجاره؛
 * رهن کامل ← معادل اجاره؛ کوتاه‌مدت ← مجموع شب‌ها. همه با اسلایدر و ارقام فارسی.
 */
export function Calculator({ dealType, price, rentCheques, deposit }: Props) {
  switch (dealType) {
    case 'sale':
      return <MortgageCalculator price={price} />;
    case 'rent':
      return <RentCalculator price={price} rentCheques={rentCheques} deposit={deposit} />;
    case 'full_mortgage':
      return <MortgageToRentCalculator price={price} />;
    case 'short_term':
      return <ShortTermCalculator price={price} />;
  }
}
