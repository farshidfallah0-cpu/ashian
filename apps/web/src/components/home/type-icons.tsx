import type { PropertyType } from '@ashian/shared';
import type { ReactNode } from 'react';

/**
 * آیکون‌های اختصاصی نوع ملک: خطی، با ضخامت یکسان (۱٫۷۵) و فقط یک نقطه‌ی تأکید زعفرانی در هر آیکون،
 * هم‌خانواده با لوگوی آشیان. همه سرور-رندرند و هیچ جاوااسکریپتی نمی‌خواهند.
 * رنگ خط از `currentColor` می‌آید؛ نقطه‌ی تأکید با کلاس `fill-accent`.
 */
const base = {
  viewBox: '0 0 64 64',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** پنجره‌های کوچک: یک مربع با ابعاد ثابت */
const Win = ({ x, y, lit = false }: { x: number; y: number; lit?: boolean }) => (
  <rect
    x={x}
    y={y}
    width="5"
    height="5"
    rx="0.8"
    className={lit ? 'fill-accent stroke-accent' : undefined}
  />
);

function Apartment() {
  return (
    <svg {...base}>
      <path d="M5 56h54" />
      <path d="M14 56V9h26v47" />
      <path d="M40 24h12v32" />
      {[17, 25, 33, 41, 49].map((y) => (
        <g key={y}>
          <Win x={19} y={y - 6} lit={y === 33} />
          <Win x={29} y={y - 6} />
        </g>
      ))}
      <Win x={44} y={30} />
      <Win x={44} y={40} />
      <path d="M20 5h14" />
    </svg>
  );
}

function Villa() {
  return (
    <svg {...base}>
      <path d="M5 56h54" />
      <path d="M8 31 32 11l24 20" />
      <path d="M13 27V56h38V27" />
      <path d="M43 18v-6h5v12" />
      <path d="M27 56V42a5 5 0 0 1 10 0v14" />
      <Win x={17} y={36} />
      <Win x={42} y={36} />
      <circle cx="32" cy="25" r="2.6" className="fill-accent stroke-accent" />
      <path d="M52 56c0-5 2.5-8 5-9" />
      <path d="M7 56c0-4 2-6.5 4-7.5" />
    </svg>
  );
}

function Townhouse() {
  return (
    <svg {...base}>
      <path d="M4 56h56" />
      <path d="M6 31 15 20l9 11" />
      <path d="M24 26l8-11 8 11" />
      <path d="M40 31l9-11 9 11" />
      <path d="M8 29v27h16V26h16v30h16V29" />
      <path d="M24 56V26M40 56V26" />
      <Win x={12} y={37} />
      <Win x={28} y={34} />
      <Win x={44} y={37} />
      <path d="M12 56v-8h8v8" />
      <path d="M44 56v-8h8v8" />
      <path d="M29 56v-9h6v9" className="stroke-accent" />
    </svg>
  );
}

function Penthouse() {
  return (
    <svg {...base}>
      <path d="M5 56h54" />
      <path d="M18 56V26h28v30" />
      <path d="M14 26h36" />
      <path d="M23 26V13h18v13" />
      <path d="M23 13h18" />
      <path d="M27 26V17M32 26V17M37 26V17" />
      <path d="M14 26v-4M50 26v-4" />
      <path d="M14 22h36" />
      <Win x={22} y={32} />
      <Win x={30} y={32} />
      <Win x={38} y={32} />
      <Win x={22} y={42} />
      <Win x={30} y={42} lit />
      <Win x={38} y={42} />
      <path d="M32 13V7" />
      <circle cx="32" cy="6" r="1.6" className="fill-accent stroke-accent" />
    </svg>
  );
}

function Duplex() {
  return (
    <svg {...base}>
      <path d="M4 56h56" />
      <path d="M8 20h48" />
      <path d="M12 20V56M52 20V56" />
      <path d="M32 20V56" />
      <path d="M12 38h40" />
      <Win x={19} y={26} />
      <Win x={40} y={26} />
      <path d="M17 56V47a4 4 0 0 1 8 0v9" />
      <path d="M39 56V47a4 4 0 0 1 8 0v9" className="stroke-accent" />
      <path d="M6 20l5-7h42l5 7" />
    </svg>
  );
}

function HotelApartment() {
  return (
    <svg {...base}>
      <path d="M5 56h54" />
      <path d="M14 56V12h36v44" />
      <rect x="22" y="17" width="20" height="11" rx="1.6" />
      <path d="M25 24v-3M25 23h14M39 23v-3" />
      <rect
        x="27"
        y="19.5"
        width="4.5"
        height="2.4"
        rx="0.6"
        className="fill-accent stroke-accent"
      />
      <Win x={19} y={34} />
      <Win x={29.5} y={34} />
      <Win x={40} y={34} />
      <path d="M14 46h36" />
      <path d="M14 46c2 3 5 3 6.3 0 1.3 3 4.7 3 6.2 0 1.5 3 4.5 3 5.8 0 1.5 3 4.5 3 5.8 0 1.5 3 4.5 3 6 0" />
      <path d="M28 56V50h8v6" />
    </svg>
  );
}

const ICONS: Record<PropertyType, () => ReactNode> = {
  apartment: Apartment,
  villa: Villa,
  townhouse: Townhouse,
  penthouse: Penthouse,
  duplex: Duplex,
  hotel_apartment: HotelApartment,
};

export function PropertyTypeIcon({ type, className }: { type: PropertyType; className?: string }) {
  const Icon = ICONS[type];
  return (
    <span className={className} aria-hidden>
      <Icon />
    </span>
  );
}
