'use client';

import type { ReactNode } from 'react';
import { useResults } from './results-shell';

/** دکمه‌ی قلب. اگر کاربر وارد نشده باشد به صفحه‌ی ورود می‌رود و بعد برمی‌گردد. */
export function FavoriteButton({
  publicId,
  title,
  icon,
  activeIcon,
}: {
  publicId: string;
  title: string;
  icon: ReactNode;
  activeIcon: ReactNode;
}) {
  const { favorites, toggleFavorite } = useResults();
  const active = favorites.has(publicId);
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `حذف «${title}» از علاقه‌مندی‌ها` : `افزودن «${title}» به علاقه‌مندی‌ها`}
      onClick={() => void toggleFavorite(publicId)}
      className={`flex size-9 items-center justify-center rounded-full bg-white shadow-xs transition-transform duration-150 active:scale-90 ${
        active ? 'text-danger' : 'text-ink hover:text-danger'
      }`}
    >
      {active ? activeIcon : icon}
    </button>
  );
}
