import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  // PostGIS جدول‌های خودش را می‌سازد؛ نباید وارد migration ما شوند
  extensionsFilters: ['postgis'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54329/postgres',
  },
});
