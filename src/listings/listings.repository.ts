// این فایل قرارداد انبار آگهی‌هاست؛ یعنی «انبار باید این چهار کار را بلد باشد».
// این فایل دیگر خودش چیزی ذخیره نمی‌کند؛ فقط قول می‌دهد انبار چه کارهایی می‌کند.
// پیاده‌سازی واقعی در فایل `listings.prisma-repository.ts` است و با دیتابیس حرف می‌زند.
// اگر یک روز انبار عوض شد، فقط پیاده‌سازی عوض می‌شود؛
// بقیه‌ی کد — سرویس، کنترلر و سرور `MCP` (ام‌سی‌پی) — هیچی نمی‌فهمند.
// به این می‌گویند `Repository` (ریپازیتوری).

// نکته: این چهار کار با دیتابیس از راه شبکه حرف می‌زنند، پس ناهمگام‌اند؛
// یعنی جوابشان قول (`Promise` — پرامیس) است و باید با `await` (اویت) صبر کرد.

import { Listing } from '../fetch/listing.interface';

export abstract class ListingsRepository {
  // همه‌ی آگهی‌های ذخیره‌شده را برمی‌گرداند؛ اگر چیزی نبود، لیست خالی می‌دهد.
  abstract findAll(): Promise<Listing[]>;

  // یک آگهی را با شناسه‌اش پیدا می‌کند؛ اگر نبود، خالی برمی‌گرداند.
  abstract findByToken(token: string): Promise<Listing | undefined>;

  // همه‌ی آگهی‌ها را ذخیره می‌کند؛ یعنی جای همه‌ی قبلی‌ها را با این لیست عوض می‌کند.
  abstract saveAll(listings: Listing[]): Promise<void>;

  // آگهی‌های تازه را به انبار اضافه می‌کند، ولی تکراری‌ها را دوباره ذخیره نمی‌کند.
  // برمی‌گرداند چند تا تازه اضافه شد (`added`)، از هر منبع چند تا تازه آمد (`addedBySource`)
  // و حالا در کل چند تا هست (`total`).
  abstract upsert(incoming: Listing[]): Promise<{
    added: number;
    addedBySource: { divar: number; sheypoor: number };
    total: number;
  }>;
}
