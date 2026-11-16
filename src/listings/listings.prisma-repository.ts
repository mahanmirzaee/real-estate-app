// این فایل انبار آگهی‌هاست؛ تنها جایی که با دیتابیس حرف می‌زند.
// بقیه‌ی کد هیچ‌وقت مستقیم سراغ دیتابیس نمی‌رود؛ فقط به این فایل می‌گوید
// «ذخیره کن» یا «بده». این همان قرارداد `ListingsRepository` (ریپازیتوری) است،
// ولی این بار پیاده‌سازیش با دیتابیس است، نه فایل `JSON` (جیسون).

import { Injectable } from '@nestjs/common';
import { Listing as PrismaListing } from '@prisma/client';
import { Listing } from '../fetch/listing.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsRepository } from './listings.repository';

@Injectable()
export class PrismaListingsRepository extends ListingsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // یک ردیف دیتابیس را به شکل آگهی برنامه برمی‌گردانیم؛
  // دیتابیس تاریخ را به شکل تاریخ می‌دهد، ولی برنامه تاریخ را به شکل متن می‌خواهد.
  private toListing(row: PrismaListing): Listing {
    return {
      token: row.token,
      title: row.title,
      priceText: row.priceText,
      district: row.district,
      category: row.category,
      categoryLabel: row.categoryLabel,
      url: row.url,
      isPersonal: row.isPersonal,
      source: row.source as 'divar' | 'sheypoor',
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  // همه‌ی آگهی‌های ذخیره‌شده را برمی‌گرداند؛ قدیمی‌ها اول، تازه‌ها آخر —
  // دقیقاً همان ترتیبی که قبلاً با فایل بود.
  async findAll(): Promise<Listing[]> {
    const rows = await this.prisma.listing.findMany({
      orderBy: [{ fetchedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toListing(row));
  }

  // یک آگهی را با شناسه‌اش پیدا می‌کند؛ اگر نبود، خالی برمی‌گرداند.
  async findByToken(token: string): Promise<Listing | undefined> {
    const row = await this.prisma.listing.findUnique({ where: { token } });
    return row ? this.toListing(row) : undefined;
  }

  // همه‌ی آگهی‌ها را ذخیره می‌کند؛ اول همه‌ی قبلی‌ها را پاک می‌کند
  // و بعد لیست تازه را می‌نویسد — هر دو کار با هم، در یک تراکنش،
  // تا وسط کار چیزی نصفه نماند.
  async saveAll(listings: Listing[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.listing.deleteMany(),
      this.prisma.listing.createMany({
        data: listings.map((listing) => ({
          token: listing.token,
          title: listing.title,
          priceText: listing.priceText,
          district: listing.district,
          category: listing.category,
          categoryLabel: listing.categoryLabel,
          url: listing.url,
          isPersonal: listing.isPersonal,
          source: listing.source,
          fetchedAt: new Date(listing.fetchedAt),
        })),
      }),
    ]);
  }

  // آگهی‌های تازه را به انبار اضافه می‌کند، ولی تکراری‌ها را دوباره ذخیره نمی‌کند؛
  // دیتابیس خودش با `skipDuplicates` (اسکیپ دوپلیکیتس) تکراری‌ها را رد می‌کند.
  async upsert(incoming: Listing[]): Promise<{ added: number; total: number }> {
    const created = await this.prisma.listing.createMany({
      data: incoming.map((listing) => ({
        token: listing.token,
        title: listing.title,
        priceText: listing.priceText,
        district: listing.district,
        category: listing.category,
        categoryLabel: listing.categoryLabel,
        url: listing.url,
        isPersonal: listing.isPersonal,
        source: listing.source,
        fetchedAt: new Date(listing.fetchedAt),
      })),
      skipDuplicates: true,
    });
    const total = await this.prisma.listing.count();
    return { added: created.count, total };
  }
}
