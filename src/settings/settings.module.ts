// این فایل جعبه‌ی تنظیمات را سر هم می‌کند؛ یعنی «محله‌ها کجا ذخیره می‌شوند».
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  // سرویس تنظیمات را به جعبه‌های دیگر هم می‌دهیم؛
  // میز اول (گرفتن آگهی) در هر تازه‌سازی محله‌ها را از همین‌جا می‌خواند.
  exports: [SettingsService],
})
export class SettingsModule {}
