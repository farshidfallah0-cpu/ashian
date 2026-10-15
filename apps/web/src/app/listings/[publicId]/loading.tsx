/** اسکلتون هم‌اندازه‌ی صفحه‌ی آگهی تا هنگام بارگذاری چیدمان نپرد (CLS صفر) */
export default function ListingLoading() {
  return (
    <main id="main" aria-busy="true" aria-label="در حال بارگذاری آگهی">
      <div className="container-page pt-5">
        <div className="skeleton h-4 w-64" />
        <div className="mt-4 grid gap-2 md:h-[26rem] md:grid-cols-4 md:grid-rows-2 lg:h-[32rem]">
          <div className="skeleton aspect-[4/3] md:col-span-2 md:row-span-2 md:aspect-auto" />
          <div className="skeleton hidden md:block" />
          <div className="skeleton hidden md:block" />
          <div className="skeleton hidden md:block" />
          <div className="skeleton hidden md:block" />
        </div>
      </div>
      <div className="container-page mt-10 grid gap-14 pb-14 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <div className="skeleton h-6 w-40" />
          <div className="skeleton mt-5 h-12 w-72" />
          <div className="skeleton mt-6 h-10 w-full max-w-xl" />
          <div className="skeleton mt-3 h-5 w-60" />
          <div className="skeleton mt-10 h-28 w-full" />
          <div className="skeleton mt-12 h-40 w-full" />
        </div>
        <div className="skeleton hidden h-[26rem] lg:block" />
      </div>
    </main>
  );
}
