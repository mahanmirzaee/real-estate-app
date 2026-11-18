// این فایل میز دوم بنگاه را سر هم می‌کند؛ یعنی «فیلتر و ذخیره‌ی آگهی‌ها» را.

import { forwardRef, Module } from '@nestjs/common';
import { FetchModule } from '../fetch/fetch.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { SettingsModule } from '../settings/settings.module';
import { ListingsController } from './listings.controller';
import { PrismaListingsRepository } from './listings.prisma-repository';
import { ListingsRepository } from './listings.repository';
import { ListingsService } from './listings.service';

@Module({
  // برای گرفتن آگهی تازه، به میز اول (ماژول گرفتن آگهی) نیاز داریم؛
  // برای ذخیره کردن هم به ماژول دیتابیس نیاز داریم؛
  // برای حافظه‌ی موقت هم به ماژول ردیس نیاز داریم؛
  // برای اینکه دکمه‌ی دستی تایمر را از اول بیندازد، به جعبه‌ی زمان‌بندی نیاز داریم.
  // جعبه‌ی زمان‌بندی هم به ما نیاز دارد، پس با `forwardRef` (فوروارد رف) به هم وصل می‌شویم.
  // محله‌های پیکربندی‌شده هم از جعبه‌ی تنظیمات می‌آیند.
  imports: [FetchModule, PrismaModule, RedisModule, SettingsModule, forwardRef(() => SchedulerModule)],
  controllers: [ListingsController],
  providers: [
    ListingsService,
    // قرارداد انبار را با پیاده‌سازی دیتابیسی پر می‌کنیم؛
    // سرویس فقط قرارداد را می‌شناسد و نمی‌داند پشتش دیتابیس است یا فایل.
    { provide: ListingsRepository, useClass: PrismaListingsRepository },
  ],
  // سرویس آگهی‌ها را به جعبه‌های دیگر هم می‌دهیم؛ مثلاً سرور `MCP` (ام‌سی‌پی) از همین استفاده می‌کند.
  exports: [ListingsService],
})
export class ListingsModule {}
