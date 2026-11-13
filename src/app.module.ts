// این فایل سه میز بنگاه را کنار هم می‌چیند و یک برنامه می‌سازد.
// هر میز فقط کار خودش را می‌کند و با میزهای دیگر فقط از راه مشخص حرف می‌زند.

import { Module } from '@nestjs/common';
import { ConvertModule } from './convert/convert.module';
import { FetchModule } from './fetch/fetch.module';
import { ListingsModule } from './listings/listings.module';

@Module({
  imports: [FetchModule, ListingsModule, ConvertModule],
})
export class AppModule {}
