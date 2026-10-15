'use client';

import { formatDate, formatNumber, formatPrice, toPersianDigits } from '@ashian/shared';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Checkbox,
  Chip,
  Combobox,
  Drawer,
  Dropdown,
  EmptyState,
  Input,
  ListingCardSkeleton,
  Logo,
  Modal,
  Pagination,
  PriceText,
  Radio,
  RadioGroup,
  RangeSlider,
  Reveal,
  RevealGroup,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  m,
  slideUp,
  toast,
  type ComboboxOption,
} from '@ashian/ui';
import {
  ArrowLeft,
  Bed,
  Bookmark,
  DotsThree,
  Heart,
  Info,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Share,
  Trash,
} from '@phosphor-icons/react/ssr';
import { useState, type ReactNode } from 'react';

/* ───────── داده‌ی نمونه ───────── */

const COMMUNITIES: ComboboxOption[] = [
  { value: 'marina', label: 'دبی مارینا', hint: 'دبی', count: 1284 },
  { value: 'downtown', label: 'داون‌تاون دبی', hint: 'دبی', count: 932 },
  { value: 'jvc', label: 'جمیرا ویلیج سیرکل', hint: 'JVC', count: 1107 },
  { value: 'business-bay', label: 'بیزنس بی', hint: 'دبی', count: 764 },
  { value: 'palm', label: 'پالم جمیرا', hint: 'دبی', count: 318 },
  { value: 'jlt', label: 'جمیرا لیک تاورز', hint: 'JLT', count: 689 },
  { value: 'deira', label: 'دیره', hint: 'دبی قدیم', count: 421 },
  { value: 'barsha', label: 'البرشا هایتس', hint: 'تیکام', count: 377 },
  { value: 'creek', label: 'دبی کریک هاربر', hint: 'دبی', count: 254 },
];

// توزیع قیمت اجاره‌ی سالانه؛ شکل واقعی: دم بلند به سمت گران
const HISTOGRAM = [
  3, 5, 9, 14, 22, 31, 38, 44, 40, 33, 27, 21, 16, 12, 9, 7, 5, 4, 3, 2, 2, 1, 1, 1,
];

const SWATCHES: { name: string; token: string; hex: string; role: string; dark?: boolean }[] = [
  {
    name: 'سرمه‌ای',
    token: 'brand',
    hex: '#1B2B4B',
    role: 'رنگ اصلی، عنوان‌ها، دکمه‌ی تیره',
    dark: true,
  },
  {
    name: 'زعفرانی',
    token: 'accent',
    hex: '#D97B29',
    role: 'فقط CTA اصلی و نکته‌ی مهم',
    dark: true,
  },
  { name: 'جنگلی', token: 'verified', hex: '#1E7A52', role: 'تأییدشده، موفقیت', dark: true },
  { name: 'آجری', token: 'danger', hex: '#C2410C', role: 'خطا و هشدار', dark: true },
  { name: 'جوهری', token: 'ink', hex: '#14161A', role: 'متن اصلی', dark: true },
  { name: 'خاکستری', token: 'muted', hex: '#6B6F76', role: 'متن کم‌رنگ', dark: true },
  { name: 'خط', token: 'line', hex: '#E8E5DF', role: 'خطوط و جداکننده' },
  { name: 'سفید گرم', token: 'surface', hex: '#F7F6F3', role: 'سطح دوم' },
];

const TYPE_SCALE = [
  { cls: 'text-5xl', size: 56, text: 'رو به دریا' },
  { cls: 'text-4xl', size: 44, text: 'دو خوابه در دبی مارینا' },
  { cls: 'text-3xl', size: 36, text: 'آپارتمان‌های تأییدشده‌ی این هفته' },
  { cls: 'text-2xl', size: 28, text: 'ویژگی‌های کلیدی ملک' },
  { cls: 'text-xl', size: 22, text: 'اجاره‌ی سالانه با چهار چک' },
  { cls: 'text-lg', size: 18, text: 'طبقه‌ی ۲۴، چیدمان باز، آشپزخانه‌ی مجهز' },
  { cls: 'text-base', size: 16, text: 'متن اصلی صفحه با ارتفاع خط ۱٫۸ برای خوانایی فارسی' },
  { cls: 'text-sm', size: 14, text: 'توضیح تکمیلی، تاریخ و جزئیات فرعی' },
  { cls: 'text-xs', size: 12, text: 'برچسب‌ها و یادداشت‌های ریز' },
];

/* ───────── اجزای خود صفحه ───────── */

const SECTIONS = [
  ['colors', 'رنگ'],
  ['type', 'تایپوگرافی'],
  ['buttons', 'دکمه'],
  ['forms', 'فرم'],
  ['filters', 'چیپ و نشان'],
  ['nav', 'ناوبری'],
  ['layers', 'لایه‌ها'],
  ['states', 'حالت‌ها'],
  ['data', 'قیمت و آواتار'],
  ['motion', 'موشن'],
] as const;

function Section({
  id,
  index,
  title,
  note,
  children,
}: {
  id: string;
  index: number;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="grid gap-x-10 gap-y-8 border-t border-ink py-12 lg:grid-cols-[14rem_1fr] lg:py-16"
    >
      <header className="lg:sticky lg:top-24 lg:self-start">
        <div className="font-display text-sm text-accent">
          {toPersianDigits(String(index).padStart(2, '0'))}
        </div>
        <h2 className="mt-1 text-3xl text-ink">{title}</h2>
        {note && <p className="mt-3 text-sm text-muted">{note}</p>}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Specimen({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="border-b border-line py-6 first:pt-0 last:border-b-0">
      <div className="mb-4 text-xs text-muted">{label}</div>
      <div className={className ?? 'flex flex-wrap items-center gap-3'}>{children}</div>
    </div>
  );
}

export function DesignSpecimen() {
  const [community, setCommunity] = useState<string | null>('marina');
  const [range, setRange] = useState<[number, number]>([90_000, 180_000]);
  const [beds, setBeds] = useState<string[]>(['2']);
  const [filters, setFilters] = useState(['دبی مارینا', 'مبله', 'دو خوابه']);
  const [page, setPage] = useState(5);
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [furnished, setFurnished] = useState(true);
  const [email, setEmail] = useState('ali@');

  const toggleBed = (b: string) =>
    setBeds((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  return (
    <div className="min-h-dvh bg-bg">
      {/* ───────── سرصفحه‌ی مجله‌ای ───────── */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <nav
            aria-label="بخش‌های سیستم دیزاین"
            className="scrollbar-none hidden gap-6 overflow-x-auto text-sm text-muted lg:flex"
          >
            {SECTIONS.map(([id, label], i) => (
              <a
                key={id}
                href={`#${id}`}
                className="whitespace-nowrap transition-colors duration-150 hover:text-ink"
              >
                <span className="text-faint">
                  {toPersianDigits(String(i + 1).padStart(2, '0'))}
                </span>{' '}
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="container-page">
        <div className="grid gap-8 pb-14 pt-14 lg:grid-cols-[14rem_1fr] lg:gap-10 lg:pb-20 lg:pt-24">
          <div className="text-sm text-muted">
            <div>نسخه‌ی ۰٫۱</div>
            <div className="mt-1">{formatDate(new Date(), 'long')}</div>
          </div>
          <div>
            <h1 className="max-w-3xl text-4xl leading-[1.15] text-brand md:text-5xl lg:text-[4rem]">
              سیستم دیزاین آشیان
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              زبان بصری یک نشریه‌ی ملکی: تایپوگرافی پررنگ، خطوط نازک، رنگ کم و دقیق. هر کامپوننت در
              حالت‌های عادی، هاور، فوکوس، غیرفعال و خطا نمایش داده شده است.
            </p>
          </div>
        </div>

        {/* ───────── ۰۱ رنگ ───────── */}
        <Section
          id="colors"
          index={1}
          title="رنگ"
          note="پس‌زمینه‌ی سفید، یک رنگ اصلی جدی، و یک رنگ تأکید گرم که فقط جای مهم می‌آید."
        >
          <div className="grid grid-cols-2 border-s border-t border-line sm:grid-cols-4">
            {SWATCHES.map((s) => (
              <div key={s.token} className="border-b border-e border-line">
                <div
                  className="h-28 w-full"
                  style={{ backgroundColor: s.hex }}
                  role="img"
                  aria-label={`نمونه‌ی رنگ ${s.name}`}
                />
                <div className="p-3">
                  <div className="text-base text-ink">{s.name}</div>
                  <div dir="ltr" className="text-start text-xs text-muted">
                    {s.hex} · {s.token}
                  </div>
                  <div className="mt-2 text-xs text-muted">{s.role}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ───────── ۰۲ تایپوگرافی ───────── */}
        <Section
          id="type"
          index={2}
          title="تایپوگرافی"
          note="تیتر: Estedad (جایگزین Peyda). متن: Vazirmatn (جایگزین IRANSansX). ارتفاع خط متن ۱٫۸ و تیتر حدود ۱٫۳."
        >
          <div>
            {TYPE_SCALE.map((t) => (
              <div
                key={t.size}
                className="grid items-baseline gap-4 border-b border-line py-4 sm:grid-cols-[4rem_1fr]"
              >
                <span className="text-xs text-muted">{toPersianDigits(t.size)} px</span>
                <span
                  className={`${t.cls} ${t.size >= 22 ? 'font-display font-bold' : ''} text-ink`}
                >
                  {t.text}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <p className="text-base text-ink-2">
              اجاره‌ی سالانه در دبی معمولاً با یک تا دوازده چک پرداخت می‌شود. در آشیان قیمت همیشه با
              یک ارز نمایش داده می‌شود و تاریخ انتشار روی هر آگهی دیده می‌شود، تا انتخاب شما بر
              پایه‌ی اطلاعات دقیق باشد.
            </p>
            <div className="border-s-2 border-accent ps-5 font-display text-2xl leading-[1.5] text-brand">
              قیمتِ بدون ابهام، آگهیِ بدون تکرار.
            </div>
          </div>
          <p className="mt-8 text-xl text-ink">
            ارقام فارسی: {formatNumber(1234567)} · {formatDate(new Date(), 'numeric')} ·{' '}
            {formatPrice(125000)}
          </p>
        </Section>

        {/* ───────── ۰۳ دکمه ───────── */}
        <Section
          id="buttons"
          index={3}
          title="دکمه"
          note="رنگ تأکید فقط روی دکمه‌ی اصلی هر صفحه. گوشه‌ی ۴ پیکسل، فشردن با کمی کوچک شدن."
        >
          <Specimen label="اصلی (تأکید)">
            <Button variant="primary" size="lg">
              درخواست بازدید
            </Button>
            <Button variant="primary">ثبت آگهی</Button>
            <Button variant="primary" size="sm">
              ذخیره
            </Button>
            <Button variant="primary" disabled>
              غیرفعال
            </Button>
          </Specimen>
          <Specimen label="تیره">
            <Button variant="dark" size="lg">
              جستجو
            </Button>
            <Button variant="dark">اعمال فیلتر</Button>
            <Button variant="dark" size="sm">
              مشاهده
            </Button>
            <Button variant="dark" disabled>
              غیرفعال
            </Button>
          </Specimen>
          <Specimen label="ثانویه و متنی">
            <Button variant="secondary" size="lg">
              مقایسه
            </Button>
            <Button variant="secondary">پاک کردن همه</Button>
            <Button variant="secondary" size="sm" startIcon={<Phone size={16} />}>
              تماس
            </Button>
            <Button variant="text" endIcon={<ArrowLeft size={16} />}>
              مشاهده‌ی همه‌ی آگهی‌ها
            </Button>
          </Specimen>
          <Specimen label="حالت بارگذاری (عرض ثابت می‌ماند)">
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 1800);
              }}
            >
              {loading ? 'در حال ارسال' : 'ارسال درخواست'}
            </Button>
            <Button variant="dark" loading>
              در حال ذخیره
            </Button>
            <Button variant="secondary" loading>
              بارگذاری
            </Button>
          </Specimen>
          <Specimen label="آیکونی (با برچسب دسترسی‌پذیر)">
            <Tooltip content="افزودن به علاقه‌مندی‌ها">
              <Button icon variant="secondary" aria-label="علاقه‌مندی">
                <Heart size={20} />
              </Button>
            </Tooltip>
            <Tooltip content="اشتراک‌گذاری">
              <Button icon variant="secondary" aria-label="اشتراک‌گذاری">
                <Share size={20} />
              </Button>
            </Tooltip>
            <Tooltip content="ذخیره‌ی جستجو">
              <Button icon variant="dark" aria-label="ذخیره‌ی جستجو">
                <Bookmark size={20} />
              </Button>
            </Tooltip>
            <Button icon variant="secondary" size="sm" aria-label="اطلاعات">
              <Info size={16} />
            </Button>
          </Specimen>
        </Section>

        {/* ───────── ۰۴ فرم ───────── */}
        <Section
          id="forms"
          index={4}
          title="فرم"
          note="فوکوس با حلقه‌ی سرمه‌ای نرم. خطا با رنگ و متن، نه فقط رنگ. فونت ۱۶ تا iOS زوم نکند."
        >
          <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
            <Input label="نام و نام خانوادگی" placeholder="مثلاً علی رضایی" />
            <Input
              label="شماره موبایل"
              placeholder="۵۰ ۱۲۳ ۴۵۶۷"
              ltr
              start={<span dir="ltr">+971</span>}
              hint="کد تأیید به این شماره پیامک می‌شود"
            />
            <Input label="بودجه‌ی سالانه" placeholder="۱۲۰٬۰۰۰" end="درهم" />
            <Input
              label="ایمیل"
              ltr
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={email.includes('.') ? undefined : 'نشانی ایمیل کامل نیست'}
            />
            <Input
              label="جستجو"
              placeholder="محله، برج یا کد آگهی"
              start={<MagnifyingGlass size={18} />}
            />
            <Input label="غیرفعال" value="کد آگهی ۴۸۲۱۹" disabled readOnly />
            <Select
              label="تعداد خواب"
              defaultValue="2"
              options={[
                { value: '0', label: 'استودیو' },
                { value: '1', label: 'یک خوابه' },
                { value: '2', label: 'دو خوابه' },
                { value: '3', label: 'سه خوابه' },
                { value: '4', label: 'چهار خوابه یا بیشتر' },
              ]}
            />
            <Combobox
              label="محله"
              options={COMMUNITIES}
              value={community}
              onValueChange={setCommunity}
              placeholder="نام محله را بنویسید"
              hint="جستجو با «ي» و «ی» یا «آ» و «ا» فرقی ندارد"
            />
            <Textarea
              label="توضیحات"
              placeholder="چیدمان، امکانات، شرایط پرداخت…"
              wrapperClassName="md:col-span-2"
            />
          </div>

          <div className="mt-10 grid gap-10 md:grid-cols-3">
            <div className="flex flex-col gap-4">
              <div className="text-sm font-medium">امکانات</div>
              <Checkbox label="پارکینگ اختصاصی" defaultChecked />
              <Checkbox label="استخر" description="مشترک ساختمان" />
              <Checkbox label="باشگاه ورزشی" checked="indeterminate" />
              <Checkbox label="غیرفعال" disabled />
            </div>
            <div className="flex flex-col gap-4">
              <div className="text-sm font-medium">نوع پرداخت</div>
              <RadioGroup defaultValue="4">
                <Radio value="1" label="یک چک" />
                <Radio value="4" label="چهار چک" description="رایج‌ترین" />
                <Radio value="12" label="دوازده چک" />
              </RadioGroup>
            </div>
            <div className="flex flex-col gap-4">
              <div className="text-sm font-medium">گزینه‌ها</div>
              <Switch label="مبله" checked={furnished} onCheckedChange={setFurnished} />
              <Switch label="هشدار آگهی جدید" defaultChecked />
              <Switch label="غیرفعال" disabled />
            </div>
          </div>

          <div className="mt-12 max-w-xl">
            <div className="mb-4 text-sm font-medium">اجاره‌ی سالانه (توزیع آگهی‌ها)</div>
            <RangeSlider
              label="اجاره‌ی سالانه"
              min={40_000}
              max={400_000}
              step={5_000}
              value={range}
              onValueChange={setRange}
              histogram={HISTOGRAM}
              format={(v) => formatPrice(v)}
            />
          </div>
        </Section>

        {/* ───────── ۰۵ چیپ و نشان ───────── */}
        <Section
          id="filters"
          index={5}
          title="چیپ و نشان"
          note="هر چیپ تعداد نتایج را قبل از کلیک نشان می‌دهد. هر نشان هم رنگ دارد هم آیکون."
        >
          <Specimen label="چیپ فیلتر با شمارنده">
            {[
              ['0', 'استودیو', 412],
              ['1', 'یک خوابه', 1840],
              ['2', 'دو خوابه', 2203],
              ['3', 'سه خوابه', 967],
              ['4', 'چهار خوابه+', 304],
            ].map(([v, label, count]) => (
              <Chip
                key={v as string}
                count={count as number}
                selected={beds.includes(v as string)}
                onClick={() => toggleBed(v as string)}
              >
                {label}
              </Chip>
            ))}
          </Specimen>
          <Specimen label="فیلترهای فعال با دکمه‌ی حذف">
            {filters.map((f) => (
              <Chip
                key={f}
                selected
                onRemove={() => setFilters((cur) => cur.filter((x) => x !== f))}
              >
                {f}
              </Chip>
            ))}
            {filters.length > 0 ? (
              <Button variant="text" size="sm" onClick={() => setFilters([])}>
                پاک کردن همه
              </Button>
            ) : (
              <Button
                variant="text"
                size="sm"
                onClick={() => setFilters(['دبی مارینا', 'مبله', 'دو خوابه'])}
              >
                بازگردانی نمونه
              </Button>
            )}
          </Specimen>
          <Specimen label="نشان‌ها">
            <Badge kind="verified" />
            <Badge kind="featured" />
            <Badge kind="new" />
            <Badge kind="topAgent" />
            <Badge kind="verified" compact />
          </Specimen>
        </Section>

        {/* ───────── ۰۶ ناوبری ───────── */}
        <Section
          id="nav"
          index={6}
          title="ناوبری"
          note="تب با خط زیرین، بدون قرص. صفحه‌بندی با لینک واقعی تا گوگل بخزد."
        >
          <Specimen label="تب" className="block">
            <Tabs defaultValue="photos">
              <TabsList>
                <TabsTrigger value="photos">عکس‌ها</TabsTrigger>
                <TabsTrigger value="video">ویدیو</TabsTrigger>
                <TabsTrigger value="tour">تور ۳۶۰</TabsTrigger>
                <TabsTrigger value="plan" count={2}>
                  نقشه‌ی واحد
                </TabsTrigger>
              </TabsList>
              <TabsContent value="photos">
                <p className="text-base text-muted">گالری عکس‌های ملک</p>
              </TabsContent>
              <TabsContent value="video">
                <p className="text-base text-muted">ویدیوی معرفی ملک</p>
              </TabsContent>
              <TabsContent value="tour">
                <p className="text-base text-muted">تور مجازی ۳۶۰ درجه</p>
              </TabsContent>
              <TabsContent value="plan">
                <p className="text-base text-muted">نقشه‌ی پلان واحد</p>
              </TabsContent>
            </Tabs>
          </Specimen>
          <Specimen label="صفحه‌بندی" className="block space-y-6">
            <Pagination page={page} totalPages={24} getHref={(p) => `#page-${p}`} />
            <Pagination page={1} totalPages={3} getHref={(p) => `#page-${p}`} />
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                صفحه‌ی قبل
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.min(24, p + 1))}
              >
                صفحه‌ی بعد
              </Button>
            </div>
          </Specimen>
        </Section>

        {/* ───────── ۰۷ لایه‌ها ───────── */}
        <Section
          id="layers"
          index={7}
          title="لایه‌ها"
          note="در موبایل، Modal خودکار به Bottom Sheet قابل کشیدن تبدیل می‌شود (پنجره را باریک کنید)."
        >
          <Specimen label="Modal · Drawer · Bottom Sheet">
            <Button variant="dark" onClick={() => setModal(true)}>
              Modal
            </Button>
            <Button variant="secondary" onClick={() => setDrawer(true)}>
              Drawer فیلترها
            </Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Bottom Sheet
            </Button>
          </Specimen>
          <Specimen label="منو و راهنما">
            <Dropdown
              trigger={
                <Button variant="secondary" endIcon={<DotsThree size={20} weight="bold" />}>
                  اقدام‌ها
                </Button>
              }
              items={[
                { type: 'label', label: 'آگهی' },
                { label: 'ویرایش', icon: <PencilSimple size={18} /> },
                { label: 'اشتراک‌گذاری', icon: <Share size={18} /> },
                { type: 'separator' },
                { label: 'حذف آگهی', icon: <Trash size={18} />, danger: true },
              ]}
            />
            <Tooltip content="این قیمت نسبت به میانگین محله ۸٪ کمتر است">
              <Button variant="text" startIcon={<Info size={16} />}>
                چرا این قیمت؟
              </Button>
            </Tooltip>
          </Specimen>
          <Specimen label="اعلان (Toast)">
            <Button
              variant="secondary"
              onClick={() =>
                toast({ title: 'به علاقه‌مندی‌ها اضافه شد', description: 'دو خوابه در دبی مارینا' })
              }
            >
              خنثی
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: 'جستجو ذخیره شد',
                  description: 'هشدار روزانه فعال است',
                  tone: 'success',
                })
              }
            >
              موفق
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: 'ارسال نشد',
                  description: 'اتصال اینترنت را بررسی کنید',
                  tone: 'error',
                })
              }
            >
              خطا
            </Button>
          </Specimen>

          <Modal
            open={modal}
            onOpenChange={setModal}
            title="درخواست بازدید"
            description="مشاور ظرف ۳۰ دقیقه با شما تماس می‌گیرد."
            footer={
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setModal(false)}>
                  انصراف
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setModal(false);
                    toast({ title: 'درخواست ثبت شد', tone: 'success' });
                  }}
                >
                  ارسال درخواست
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-5">
              <Input label="نام" placeholder="نام شما" />
              <Input label="شماره موبایل" ltr placeholder="+971 50 123 4567" />
              <Textarea label="پیام (اختیاری)" placeholder="زمان مناسب بازدید…" />
            </div>
          </Modal>

          <Drawer
            open={drawer}
            onOpenChange={setDrawer}
            title="فیلترهای بیشتر"
            footer={
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setDrawer(false)}>
                  پاک کردن
                </Button>
                <Button variant="dark" className="flex-1" onClick={() => setDrawer(false)}>
                  نمایش ۱٬۲۴۰ آگهی
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-6">
              <Switch label="مبله" defaultChecked />
              <Switch label="فقط تأییدشده‌ها" defaultChecked />
              <Checkbox label="پارکینگ" defaultChecked />
              <Checkbox label="بالکن" />
              <Checkbox label="استخر" />
            </div>
          </Drawer>

          <BottomSheet
            open={sheet}
            onOpenChange={setSheet}
            title="مرتب‌سازی"
            footer={
              <Button variant="dark" className="w-full" onClick={() => setSheet(false)}>
                اعمال
              </Button>
            }
          >
            <RadioGroup defaultValue="new">
              <Radio value="new" label="جدیدترین" />
              <Radio value="cheap" label="ارزان‌ترین" />
              <Radio value="expensive" label="گران‌ترین" />
              <Radio value="area" label="بیشترین متراژ" />
            </RadioGroup>
            <p className="mt-6 text-xs text-muted">
              برای بستن، این برگه را از سرتیتر به پایین بکشید.
            </p>
          </BottomSheet>
        </Section>

        {/* ───────── ۰۸ حالت‌ها ───────── */}
        <Section
          id="states"
          index={8}
          title="حالت‌ها"
          note="اسکلتون هم‌اندازه‌ی محتوای واقعی، تا هنگام بارگذاری چیدمان نپرد. حالت خالی با تصویرسازی خطی."
        >
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
            <ListingCardSkeleton />
            <ListingCardSkeleton />
            <ListingCardSkeleton className="hidden lg:flex" />
          </div>
          <div className="mt-10 border border-line">
            <EmptyState
              title="آگهی‌ای با این فیلترها پیدا نشد"
              description="محدوده‌ی قیمت را بازتر کنید یا فیلتر «مبله» را بردارید."
              action={<Button variant="dark">پاک کردن فیلترها</Button>}
            />
          </div>
        </Section>

        {/* ───────── ۰۹ قیمت و آواتار ───────── */}
        <Section id="data" index={9} title="قیمت و آواتار">
          <Specimen label="قیمت" className="flex flex-wrap items-end gap-x-10 gap-y-6">
            <PriceText amount={950} size="sm" />
            <PriceText amount={125_000} period="yearly" size="md" />
            <PriceText amount={1_250_000} size="lg" />
            <PriceText amount={2_100_000} size="xl" />
            <PriceText amount={118_000} previous={125_000} period="yearly" size="md" />
          </Specimen>
          <Specimen label="آواتار (اندازه‌ها، تأییدشده، بدون عکس)">
            <Avatar name="سارا محمدی" size="xs" />
            <Avatar name="سارا محمدی" size="sm" />
            <Avatar name="علی رضایی" size="md" verified />
            <Avatar name="نگار کریمی" size="lg" verified />
            <Avatar name="مهدی احمدی" size="xl" />
          </Specimen>
          <Specimen label="ترکیب: مشخصات کارت آگهی" className="block">
            <article className="max-w-sm">
              <div className="aspect-[4/3] bg-surface-2" role="img" aria-label="جایگاه عکس ملک" />
              <div className="mt-4 flex items-center justify-between">
                <PriceText amount={125_000} period="yearly" size="lg" />
                <Badge kind="verified" />
              </div>
              <h3 className="mt-2 text-lg text-ink">دو خوابه‌ی مبله، دبی مارینا</h3>
              <p className="mt-1 flex items-center gap-4 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Bed size={16} /> {toPersianDigits(2)} خواب
                </span>
                <span>{toPersianDigits(1_150)} فوت مربع</span>
                <span>۳ روز پیش</span>
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
                <Avatar name="علی رضایی" size="sm" verified />
                <span className="text-sm text-ink-2">علی رضایی</span>
                <Badge kind="topAgent" className="ms-auto" />
              </div>
            </article>
          </Specimen>
        </Section>

        {/* ───────── ۱۰ موشن ───────── */}
        <Section
          id="motion"
          index={10}
          title="موشن"
          note="فقط transform و opacity، بین ۱۵۰ تا ۳۵۰ میلی‌ثانیه. با «کاهش انیمیشن» در سیستم‌عامل، حرکت‌ها خودکار خاموش می‌شوند."
        >
          <Reveal>
            <p className="max-w-lg text-lg text-ink-2">
              این بخش هنگام ورود به صفحه یک بار، ملایم بالا آمد. بقیه‌ی ردیف‌ها یکی‌یکی وارد
              می‌شوند.
            </p>
          </Reveal>
          <RevealGroup className="mt-8 grid border-s border-t border-line sm:grid-cols-2">
            {[
              'باز شدن نرم کارت به صفحه‌ی آگهی',
              'انیمیشن چیپ‌ها و فیلترها',
              'هماهنگی پین نقشه و کارت',
              'اسکلتون هنگام بارگذاری',
            ].map((t, i) => (
              <m.div
                key={t}
                variants={slideUp}
                className="flex items-baseline gap-4 border-b border-e border-line p-5"
              >
                <span className="font-display text-sm text-accent">
                  {toPersianDigits(String(i + 1).padStart(2, '0'))}
                </span>
                <span className="text-base text-ink">{t}</span>
              </m.div>
            ))}
          </RevealGroup>
        </Section>
      </main>

      <footer className="border-t border-ink">
        <div className="container-page flex flex-col gap-2 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <Logo className="scale-90" />
          <span>سیستم دیزاین آشیان · مرحله‌ی ۲</span>
        </div>
      </footer>
    </div>
  );
}
