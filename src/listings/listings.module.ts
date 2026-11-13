// این فایل میز دوم بنگاه را سر هم می‌کند؛ یعنی «فیلتر و ذخیره‌ی آگهی‌ها» را.

import { Module } from '@nestjs/common';
import { FetchModule } from '../fetch/fetch.module';
import { ListingsController } from './listings.controller';
import { ListingsRepository } from './listings.repository';
import { ListingsService } from './listings.service';

@Module({
  // برای گرفتن آگهی تازه، به میز اول (ماژول گرفتن آگهی) نیاز داریم.
  imports: [FetchModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsRepository],
  // سرویس آگهی‌ها را به جعبه‌های دیگر هم می‌دهیم؛ مثلاً سرور `MCP` (ام‌سی‌پی) از همین استفاده می‌کند.
  exports: [ListingsService],
})
export class ListingsModule {}
