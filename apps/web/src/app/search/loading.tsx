import { ListingCardSkeleton } from '@ashian/ui';

/** اسکلتون هنگام بارگذاری نتایج (ناوبری بین صفحه‌ها)؛ ابعاد با کارت واقعی یکی است تا پرش نداشته باشد */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری نتایج">
      <div className="sticky top-[68px] z-30 border-b border-line bg-bg">
        <div className="container-page flex items-center gap-2.5 py-3">
          <div className="skeleton h-10 w-28" />
          <div className="skeleton hidden h-10 w-28 md:block" />
          <div className="skeleton hidden h-10 w-24 md:block" />
          <div className="skeleton hidden h-10 w-32 md:block" />
          <div className="skeleton ms-auto h-10 w-28" />
        </div>
      </div>
      <div className="container-page pb-16 pt-7">
        <div className="skeleton h-9 w-72" />
        <div className="skeleton mt-3 h-5 w-52" />
        <ul className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <ListingCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
