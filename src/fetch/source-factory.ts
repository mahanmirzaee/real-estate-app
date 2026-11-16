// این فایل کارخانه‌ی منبع‌هاست؛ یعنی «از کجا آگهی بگیریم» را انتخاب می‌کند.
// به این می‌گویند `Factory` (فکتوری): یک جا که می‌گوید کدام منبع‌ها روشن‌اند
// و بقیه‌ی کد فقط از همین‌جا لیست منبع‌ها را می‌گیرد.
// دیوار همیشه روشن است؛ شیپور را می‌شود با `SHEYPOOR_ENABLED=false` (شیپور انیبلد فالس) خاموش کرد.

import { Injectable } from '@nestjs/common';
import { DivarSource } from './divar.source';
import { ListingSource } from './listing-source.interface';
import { SheypoorSource } from './sheypoor.source';

@Injectable()
export class ListingSourceFactory {
  constructor(
    private readonly divar: DivarSource,
    private readonly sheypoor: SheypoorSource,
  ) {}

  // منبع‌های روشن را برمی‌گرداند؛ اول دیوار، بعد شیپور.
  getSources(): ListingSource[] {
    const sources: ListingSource[] = [this.divar];
    if (process.env.SHEYPOOR_ENABLED !== 'false') {
      sources.push(this.sheypoor);
    }
    return sources;
  }
}
