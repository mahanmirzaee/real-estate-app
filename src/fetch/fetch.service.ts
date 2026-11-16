// این فایل میز اول بنگاه است: از همه‌ی منبع‌های روشن آگهی خام جمع می‌کند.
// مثل سرپرست پیک‌ها که به هر پیک می‌گوید برو و برگرد، بعد همه‌ی فایل‌ها را یک جا تحویل می‌دهد.
// اگر یک منبع جواب نداد، بقیه‌ی منبع‌ها باز هم کارشان را می‌کنند و فقط خطا نوشته می‌شود.

import { Injectable, Logger } from '@nestjs/common';
import { RawPost } from './listing.interface';
import { ListingSourceFactory } from './source-factory';

@Injectable()
export class FetchService {
  private readonly logger = new Logger(FetchService.name);

  constructor(private readonly factory: ListingSourceFactory) {}

  // از همه‌ی منبع‌ها می‌گیرد؛ هر منبع حداکثر دو صفحه، تا کار خیلی طول نکشد.
  async fetchAll(maxPages = 2): Promise<RawPost[]> {
    const all: RawPost[] = [];
    for (const source of this.factory.getSources()) {
      try {
        const posts = await source.fetchAll(maxPages);
        // تعداد هر منبع را جدا می‌نویسیم تا معلوم باشد از کجا چند تا آمده است.
        this.logger.log(`از ${source.source} ${posts.length} آگهی خام گرفتیم.`);
        all.push(...posts);
      } catch (error) {
        this.logger.error(
          `گرفتن آگهی از ${source.source} نشد: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return all;
  }
}
