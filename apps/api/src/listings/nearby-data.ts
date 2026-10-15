import type { NearbyCategory } from '@ashian/shared';

export interface PlaceRecord {
  category: NearbyCategory;
  nameFa: string;
  nameEn: string;
  lng: number;
  lat: number;
}

/**
 * مجموعه‌ی دستچین‌شده‌ی نقاط شاخص دبی (مترو، مرکز خرید، بیمارستان، مدرسه).
 * مختصات تقریبی‌اند (دقت چند صد متر) و فاصله‌ها در رابط «فاصله‌ی هوایی تقریبی» نام‌گذاری می‌شوند.
 * جایگزین واقعی: یک ارائه‌دهنده‌ی POI (OpenStreetMap/Google Places) با همین شکل خروجی `PlaceRecord[]`؛
 * فقط `findNearby` در nearby.ts به این فایل وابسته است.
 */
export const PLACES: readonly PlaceRecord[] = [
  /* ───────────── مترو، ترام و مونوریل ───────────── */
  { category: 'metro', nameFa: 'ایستگاه راشدیه', nameEn: 'Rashidiya', lng: 55.393, lat: 25.229 },
  { category: 'metro', nameFa: 'ایستگاه یونیون', nameEn: 'Union', lng: 55.3139, lat: 25.2655 },
  { category: 'metro', nameFa: 'ایستگاه برجمان', nameEn: 'BurJuman', lng: 55.3027, lat: 25.2537 },
  {
    category: 'metro',
    nameFa: 'ایستگاه مرکز تجارت جهانی',
    nameEn: 'World Trade Centre',
    lng: 55.2879,
    lat: 25.2247,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه امارات تاورز',
    nameEn: 'Emirates Towers',
    lng: 55.2833,
    lat: 25.2171,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه فایننشال سنتر',
    nameEn: 'Financial Centre',
    lng: 55.2771,
    lat: 25.2115,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه برج خلیفه / دبی مال',
    nameEn: 'Burj Khalifa / Dubai Mall',
    lng: 55.2693,
    lat: 25.2013,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه بیزینس بی',
    nameEn: 'Business Bay',
    lng: 55.2625,
    lat: 25.1855,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه مال امارات',
    nameEn: 'Mall of the Emirates',
    lng: 55.2005,
    lat: 25.1197,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه دبی اینترنت سیتی',
    nameEn: 'Dubai Internet City',
    lng: 55.1658,
    lat: 25.095,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه دی‌ام‌سی‌سی (JLT)',
    nameEn: 'DMCC',
    lng: 55.1453,
    lat: 25.0762,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه ایکسپو ۲۰۲۰',
    nameEn: 'Expo 2020',
    lng: 55.15,
    lat: 24.964,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه الریقه',
    nameEn: 'Al Rigga',
    lng: 55.3235,
    lat: 25.2625,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه خور (کریک)',
    nameEn: 'Creek',
    lng: 55.3318,
    lat: 25.2347,
  },
  {
    category: 'metro',
    nameFa: 'ایستگاه شهر درمانی دبی',
    nameEn: 'Dubai Healthcare City',
    lng: 55.3256,
    lat: 25.2311,
  },
  {
    category: 'metro',
    nameFa: 'ترام مارینا (مارینا تاورز)',
    nameEn: 'Marina Towers Tram',
    lng: 55.1405,
    lat: 25.0818,
  },
  { category: 'metro', nameFa: 'ترام جی‌بی‌آر ۱', nameEn: 'JBR 1 Tram', lng: 55.1347, lat: 25.0772 },
  {
    category: 'metro',
    nameFa: 'مونوریل گیت‌وی (نخل جمیرا)',
    nameEn: 'Palm Gateway Monorail',
    lng: 55.1393,
    lat: 25.1087,
  },
  {
    category: 'metro',
    nameFa: 'مونوریل آتلانتیس (نخل جمیرا)',
    nameEn: 'Atlantis Monorail',
    lng: 55.117,
    lat: 25.1305,
  },

  /* ───────────── مراکز خرید ───────────── */
  { category: 'mall', nameFa: 'دبی مال', nameEn: 'The Dubai Mall', lng: 55.2796, lat: 25.1985 },
  {
    category: 'mall',
    nameFa: 'مال امارات',
    nameEn: 'Mall of the Emirates',
    lng: 55.2004,
    lat: 25.1181,
  },
  { category: 'mall', nameFa: 'سیتی واک', nameEn: 'City Walk', lng: 55.263, lat: 25.2065 },
  { category: 'mall', nameFa: 'دبی مارینا مال', nameEn: 'Dubai Marina Mall', lng: 55.1408, lat: 25.0766 },
  { category: 'mall', nameFa: 'دی واک جی‌بی‌آر', nameEn: 'The Walk JBR', lng: 55.1334, lat: 25.079 },
  { category: 'mall', nameFa: 'نخیل مال', nameEn: 'Nakheel Mall', lng: 55.1375, lat: 25.112 },
  { category: 'mall', nameFa: 'ابن بطوطه مال', nameEn: 'Ibn Battuta Mall', lng: 55.1175, lat: 25.0449 },
  { category: 'mall', nameFa: 'سیرکل مال (JVC)', nameEn: 'Circle Mall', lng: 55.2098, lat: 25.0614 },
  { category: 'mall', nameFa: 'دبی هیلز مال', nameEn: 'Dubai Hills Mall', lng: 55.2436, lat: 25.1105 },
  { category: 'mall', nameFa: 'مرکاتو', nameEn: 'Mercato Mall', lng: 55.2437, lat: 25.2155 },
  {
    category: 'mall',
    nameFa: 'سیتی سنتر دیره',
    nameEn: 'City Centre Deira',
    lng: 55.3318,
    lat: 25.2528,
  },
  { category: 'mall', nameFa: 'برجمان', nameEn: 'BurJuman', lng: 55.3025, lat: 25.2534 },
  { category: 'mall', nameFa: 'الغریر سنتر', nameEn: 'Al Ghurair Centre', lng: 55.3173, lat: 25.2674 },
  {
    category: 'mall',
    nameFa: 'دبی فستیوال سیتی مال',
    nameEn: 'Dubai Festival City Mall',
    lng: 55.3543,
    lat: 25.2228,
  },
  {
    category: 'mall',
    nameFa: 'سیتی سنتر میردف',
    nameEn: 'City Centre Mirdif',
    lng: 55.4102,
    lat: 25.2165,
  },
  { category: 'mall', nameFa: 'دراگون مارت', nameEn: 'Dragon Mart', lng: 55.4139, lat: 25.1686 },
  {
    category: 'mall',
    nameFa: 'سیلیکون سنترال مال',
    nameEn: 'Silicon Central Mall',
    lng: 55.385,
    lat: 25.128,
  },
  {
    category: 'mall',
    nameFa: 'تایمز اسکوئر سنتر',
    nameEn: 'Times Square Center',
    lng: 55.212,
    lat: 25.128,
  },

  /* ───────────── بیمارستان و درمانگاه ───────────── */
  {
    category: 'hospital',
    nameFa: 'بیمارستان مدیکلینیک سیتی',
    nameEn: 'Mediclinic City Hospital',
    lng: 55.32,
    lat: 25.2305,
  },
  {
    category: 'hospital',
    nameFa: 'بیمارستان آمریکایی دبی',
    nameEn: 'American Hospital Dubai',
    lng: 55.314,
    lat: 25.236,
  },
  { category: 'hospital', nameFa: 'بیمارستان راشد', nameEn: 'Rashid Hospital', lng: 55.3157, lat: 25.2459 },
  { category: 'hospital', nameFa: 'بیمارستان دبی', nameEn: 'Dubai Hospital', lng: 55.309, lat: 25.276 },
  {
    category: 'hospital',
    nameFa: 'بیمارستان کینگز کالج دبی هیلز',
    nameEn: "King's College Hospital Dubai Hills",
    lng: 55.242,
    lat: 25.1128,
  },
  {
    category: 'hospital',
    nameFa: 'بیمارستان مدکر الصفا',
    nameEn: 'Medcare Hospital Al Safa',
    lng: 55.222,
    lat: 25.174,
  },
  {
    category: 'hospital',
    nameFa: 'مدیکلینیک میدوز',
    nameEn: 'Mediclinic Meadows',
    lng: 55.165,
    lat: 25.082,
  },
  {
    category: 'hospital',
    nameFa: 'بیمارستان مدیکلینیک پارک‌ویو',
    nameEn: 'Mediclinic Parkview Hospital',
    lng: 55.2455,
    lat: 25.0585,
  },
  {
    category: 'hospital',
    nameFa: 'بیمارستان ایران دبی',
    nameEn: 'Iranian Hospital Dubai',
    lng: 55.2662,
    lat: 25.2347,
  },

  /* ───────────── مدرسه ───────────── */
  { category: 'school', nameFa: 'کالج دبی', nameEn: 'Dubai College', lng: 55.1665, lat: 25.0937 },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی بریتانیایی دبی',
    nameEn: 'Dubai British School',
    lng: 55.1685,
    lat: 25.0775,
  },
  {
    category: 'school',
    nameFa: 'آکادمی بین‌المللی دبی',
    nameEn: 'Dubai International Academy',
    lng: 55.165,
    lat: 25.079,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی بین‌المللی امارات (میدوز)',
    nameEn: 'Emirates International School Meadows',
    lng: 55.165,
    lat: 25.08,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی بین‌المللی ولینگتون',
    nameEn: 'GEMS Wellington International School',
    lng: 55.1835,
    lat: 25.0925,
  },
  {
    category: 'school',
    nameFa: 'آکادمی آمریکایی دبی',
    nameEn: 'Dubai American Academy',
    lng: 55.2005,
    lat: 25.0985,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی انگلیسی‌زبان جمیرا (آرابین رنچز)',
    nameEn: 'Jumeirah English Speaking School, Arabian Ranches',
    lng: 55.265,
    lat: 25.0575,
  },
  {
    category: 'school',
    nameFa: 'کالج جمیرا',
    nameEn: 'Jumeirah College',
    lng: 55.2235,
    lat: 25.1731,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی رپتون دبی',
    nameEn: 'Repton School Dubai',
    lng: 55.302,
    lat: 25.1635,
  },
  {
    category: 'school',
    nameFa: 'آکادمی مدرن جمز',
    nameEn: 'GEMS Modern Academy',
    lng: 55.3085,
    lat: 25.1648,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی انگلیسی‌زبان دبی',
    nameEn: 'Dubai English Speaking School',
    lng: 55.3118,
    lat: 25.2336,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی ایرانیان دبی',
    nameEn: 'Iranian School Dubai',
    lng: 55.2684,
    lat: 25.2349,
  },
  {
    category: 'school',
    nameFa: 'آکادمی آمریکایی المزهر',
    nameEn: 'Al Mizhar American Academy',
    lng: 55.404,
    lat: 25.219,
  },
  {
    category: 'school',
    nameFa: 'مدرسه‌ی آپتاون میردف',
    nameEn: 'Uptown School Mirdif',
    lng: 55.412,
    lat: 25.2135,
  },
];
