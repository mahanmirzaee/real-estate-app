// این فایل انبار آگهی‌هاست؛ تنها جایی که با فایل ذخیره‌سازی حرف می‌زند.
// بقیه‌ی کد هیچ‌وقت مستقیم سراغ فایل نمی‌رود؛ فقط به این فایل می‌گوید
// «ذخیره کن» یا «بده». به این می‌گویند `Repository` (ریپازیتوری).

import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Listing } from '../fetch/listing.interface';

@Injectable()
export class ListingsRepository {
  // فایل ذخیره‌سازی کنار پروژه است؛ در نسخه‌ی اول دیتابیس نداریم و همین فایل کافی است.
  private readonly filePath = join(process.cwd(), 'data', 'listings.json');

  // همه‌ی آگهی‌های ذخیره‌شده را برمی‌گرداند؛ اگر فایل نبود، لیست خالی می‌دهد.
  findAll(): Listing[] {
    try {
      if (!existsSync(this.filePath)) {
        return [];
      }
      const parsed: unknown = JSON.parse(readFileSync(this.filePath, 'utf-8'));
      return Array.isArray(parsed) ? (parsed as Listing[]) : [];
    } catch {
      return [];
    }
  }

  // یک آگهی را با شناسه‌اش پیدا می‌کند؛ اگر نبود، خالی برمی‌گرداند.
  findByToken(token: string): Listing | undefined {
    return this.findAll().find((listing) => listing.token === token);
  }

  // همه‌ی آگهی‌ها را ذخیره می‌کند؛ اول در فایل موقت می‌نویسد و بعد جایش را عوض می‌کند
  // تا اگر وسط کار برق رفت، فایل اصلی خراب نشود.
  saveAll(listings: Listing[]): void {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(listings, null, 2), 'utf-8');
    renameSync(tempPath, this.filePath);
  }

  // آگهی‌های تازه را به انبار اضافه می‌کند، ولی تکراری‌ها را دوباره ذخیره نمی‌کند.
  upsert(incoming: Listing[]): { added: number; total: number } {
    const existing = this.findAll();
    const knownTokens = new Set(existing.map((listing) => listing.token));
    const fresh = incoming.filter((listing) => !knownTokens.has(listing.token));
    if (fresh.length > 0) {
      this.saveAll([...existing, ...fresh]);
    }
    return { added: fresh.length, total: existing.length + fresh.length };
  }
}
