// اجرای یک‌دستوری توسعه: pnpm dev
// در حالت lite ابتدا دیتابیس PGlite بالا می‌آید، سپس API، worker و وب با turbo.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';

if (!existsSync('.env')) {
  console.error('فایل .env پیدا نشد. ابتدا اجرا کنید: copy .env.example .env');
  process.exit(1);
}
process.loadEnvFile('.env');

const mode = process.env.INFRA_MODE ?? 'lite';
const run = (cmd, args, opts = {}) => spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });

function waitForPort(port, host = '127.0.0.1', timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error(`پورت ${port} بالا نیامد`));
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

const children = [];
function shutdown(code = 0) {
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (mode === 'lite') {
  console.log('▶ حالت lite: ساخت پکیج‌های پایه و اجرای دیتابیس PGlite...');
  const build = spawnSync('pnpm', ['turbo', 'run', 'build', '--filter=@ashian/db...'], {
    stdio: 'inherit',
    shell: true,
  });
  if (build.status !== 0) process.exit(build.status ?? 1);

  children.push(run('pnpm', ['--filter', '@ashian/db', 'lite-server']));
  const port = Number(new URL(process.env.DATABASE_URL).port || 5432);
  await waitForPort(port);
} else {
  console.log('▶ حالت full: فرض می‌شود docker compose up -d اجرا شده است.');
}

// ساخت جدول‌ها و پر کردن داده‌ی نمونه (seed فقط روی دیتابیس خالی اجرا می‌شود؛ بار اول حدود ۱۵ ثانیه)
console.log('▶ اعمال migrationها و seed...');
for (const script of ['migrate', 'seed']) {
  const step = spawnSync('pnpm', ['--filter', '@ashian/db', script], {
    stdio: 'inherit',
    shell: true,
  });
  if (step.status !== 0) {
    console.error(`مرحله‌ی ${script} ناموفق بود.`);
    shutdown(step.status ?? 1);
    await new Promise(() => {});
  }
}

const turbo = run('pnpm', ['turbo', 'run', 'dev']);
children.push(turbo);
turbo.on('exit', (code) => shutdown(code ?? 0));
