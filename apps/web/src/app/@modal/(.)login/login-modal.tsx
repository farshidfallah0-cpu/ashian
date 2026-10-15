'use client';

import { useRouter } from 'next/navigation';
import { LoginForm } from '../../../components/auth/login-form';
import { Modal } from '../../../components/listing/modal';
import { safeNext } from '../../../lib/client-api';

/**
 * ورود به‌صورت Modal روی همان صفحه (مسیر رهگیری‌شده). بدون `next` همان صفحه می‌ماند و فقط تازه می‌شود؛
 * با `next` (مثلاً از دکمه‌ی قلب) به همان مسیر می‌رود.
 */
export function LoginModal({ next }: { next?: string }) {
  const router = useRouter();
  const target = next ? safeNext(next) : null;
  return (
    <Modal title="ورود یا ثبت‌نام" onClose={() => router.back()}>
      <LoginForm
        onSuccess={() => {
          if (target && target !== window.location.pathname) router.replace(target);
          else router.back();
          router.refresh();
        }}
      />
    </Modal>
  );
}