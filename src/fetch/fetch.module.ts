// این فایل میز اول بنگاه را سر هم می‌کند؛ یعنی «گرفتن آگهی از دیوار» را.
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { Module } from '@nestjs/common';
import { DivarClient } from './divar.client';
import { FetchService } from './fetch.service';

@Module({
  // قطعه‌هایی که این جعبه می‌سازد.
  providers: [DivarClient, FetchService],
  // این قطعه را به جعبه‌های دیگر هم می‌دهیم تا بتوانند آگهی بگیرند.
  exports: [FetchService],
})
export class FetchModule {}
