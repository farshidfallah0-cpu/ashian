'use client';

import { Heart } from '@phosphor-icons/react/ssr';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '../../lib/client-api';

/** حذف از علاقه‌مندی‌ها؛ بعد از موفقیت فهرست از سرور تازه می‌شود */
export function RemoveFavorite({ publicId, title }: { publicId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`حذف «${title}» از علاقه‌مندی‌ها`}
      onClick={async () => {
        setBusy(true);
        const response = await apiRequest(`/v1/favorites/${publicId}`, { method: 'DELETE' });
        setBusy(false);
        if (response?.ok) router.refresh();
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-sm text-danger transition-colors hover:bg-danger-soft disabled:opacity-40"
    >
      <Heart size={16} weight="fill" aria-hidden />
      حذف
    </button>
  );
}