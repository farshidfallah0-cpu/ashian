'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '../../lib/client-api';
import { PromoteCard } from '../wizard/promote-card';

/** تمدید، توقف/ازسرگیری، ویرایش و ارتقا برای یک آگهی از پنل مشاور */
export function ManageActions({ publicId, status }: { publicId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  async function run(action: 'renew' | 'pause' | 'resume') {
    setBusy(action);
    setError(null);
    const response = await apiRequest(`/v1/agent/listings/${publicId}/${action}`, { method: 'POST' });
    setBusy(null);
    if (response?.ok) return router.refresh();
    let message = 'انجام نشد؛ دوباره تلاش کنید.';
    try {
      message = ((await response?.json()) as { message?: string }).message ?? message;
    } catch {
      /* بدنه‌ی JSON نبود */
    }
    setError(message);
  }

  const btn =
    'inline-flex h-8 items-center rounded-sm border border-line-strong px-3 text-sm text-ink transition-colors hover:border-ink hover:bg-surface disabled:opacity-40';
  const canRenew = status === 'active' || status === 'expired' || status === 'paused';

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {canRenew && (
          <button type="button" className={btn} disabled={busy !== null} onClick={() => void run('renew')}>
            {busy === 'renew' ? '…' : 'تمدید ۳۰ روزه'}
          </button>
        )}
        {status === 'active' && (
          <button type="button" className={btn} disabled={busy !== null} onClick={() => void run('pause')}>
            {busy === 'pause' ? '…' : 'توقف'}
          </button>
        )}
        {status === 'paused' && (
          <button type="button" className={btn} disabled={busy !== null} onClick={() => void run('resume')}>
            {busy === 'resume' ? '…' : 'ازسرگیری'}
          </button>
        )}
        <Link href={`/listings/${publicId}/edit`} prefetch={false} className={btn}>
          {status === 'draft' ? 'ادامه‌ی ثبت' : 'ویرایش'}
        </Link>
        {(status === 'active' || status === 'pending_review') && (
          <button type="button" className={btn} aria-expanded={promoting} onClick={() => setPromoting((p) => !p)}>
            ارتقا به ویژه
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {promoting && (
        <div className="mt-4">
          <PromoteCard publicId={publicId} />
        </div>
      )}
    </div>
  );
}