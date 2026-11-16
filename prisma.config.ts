// تنظیمات `Prisma` (پریزما): آدرس فایل طرح دیتابیس و آدرس دیتابیس.
// آدرس دیتابیس از متغیر `DATABASE_URL` در فایل `.env` خوانده می‌شود؛
// اول فایل `.env` را می‌خوانیم تا متغیرها در محیط برنامه باشند.

import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
