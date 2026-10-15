'use client';

import { useRouter } from 'next/navigation';
import { safeNext } from '../../lib/client-api';
import { LoginForm } from '../../components/auth/login-form';

/** صفحه‌ی کامل ورود: بعد از ورود به `next` (یا پنل کاربر) می‌رود */
export function LoginView({ next }: { next?: string }) {
  const router = useRouter();
  return (
    <LoginForm
      onSuccess={() => {
        router.replace(safeNext(next));
        router.refresh();
      }}
    />
  );
}