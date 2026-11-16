// این فایل میز اول بنگاه را سر هم می‌کند؛ یعنی «گرفتن آگهی» را.
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { Module } from '@nestjs/common';
import { DivarClient } from './divar.client';
import { DivarSource } from './divar.source';
import { FetchService } from './fetch.service';
import { SheypoorClient } from './sheypoor.client';
import { SheypoorSource } from './sheypoor.source';
import { ListingSourceFactory } from './source-factory';

@Module({
  // قطعه‌هایی که این جعبه می‌سازد.
  providers: [DivarClient, SheypoorClient, DivarSource, SheypoorSource, ListingSourceFactory, FetchService],
  // این قطعه را به جعبه‌های دیگر هم می‌دهیم تا بتوانند آگهی بگیرند.
  exports: [FetchService],
})
export class FetchModule {}
