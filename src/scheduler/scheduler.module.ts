// این فایل جعبه‌ی تازه‌سازی خودکار است؛ صف و کارگر تازه‌سازی را سر هم می‌کند.
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { RefreshProcessor } from './refresh.processor';
import { RefreshScheduler } from './refresh.scheduler';

// آدرس ردیس را از `REDIS_URL` (ردیس یوآرال) می‌خوانیم؛ مثل `redis://localhost:6379`.
// صف (`BullMQ` — بول‌ام‌کیو) خودش با همین آدرس به ردیس وصل می‌شود.
function redisConnection(): { host: string; port: number; password?: string } {
  try {
    const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
    return {
      host: url.hostname || 'localhost',
      port: Number(url.port) || 6379,
      password: url.password ? decodeURIComponent(url.password) : undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

@Module({
  imports: [
    // اتصال مشترک صف به ردیس.
    BullModule.forRoot({
      connection: redisConnection(),
    }),
    // صف «تازه‌سازی»؛ کارهای زمان‌بندی‌شده و دستی همین‌جا صف می‌کشند.
    BullModule.registerQueue({ name: 'refresh' }),
    // برای تازه‌سازی، به سرویس آگهی‌ها نیاز داریم؛ همان سرویسی که دکمه‌ی دستی هم صدا می‌زند.
    ListingsModule,
  ],
  providers: [RefreshProcessor, RefreshScheduler],
})
export class SchedulerModule {}
