// Husky فقط وقتی نصب می‌شود که git موجود و پروژه یک مخزن git باشد.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

if (process.env.CI || !existsSync('.git')) process.exit(0);

try {
  execSync('git --version', { stdio: 'ignore' });
  execSync('husky', { stdio: 'inherit' });
} catch {
  console.warn('[hooks] git در دسترس نیست؛ نصب Husky رد شد.');
}
