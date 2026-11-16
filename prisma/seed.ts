// این فایل آگهی‌های قدیمی را از فایل `data/listings.json` می‌خواند
// و داخل دیتابیس می‌ریزد؛ یعنی بذر اولیه‌ی دیتابیس.
// فقط برای اولین بار لازم است؛ آگهی تکراری (با همان شناسه) دوباره ریخته نمی‌شود.
// اجرا: `npm run db:seed`

// اول فایل `.env` را می‌خوانیم تا آدرس دیتابیس در محیط برنامه باشد.
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Listing } from '../src/fetch/listing.interface';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('متغیر DATABASE_URL در فایل .env نیست');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    // فایل قدیمی آگهی‌ها را می‌خوانیم؛ همان ۷۰ آگهی شخصی که قبلاً ذخیره شده بودند.
    const filePath = join(process.cwd(), 'data', 'listings.json');
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(parsed)) {
      throw new Error('فایل data/listings.json یک لیست نیست');
    }
    const listings = parsed as Listing[];

    // تاریخ متنی را به تاریخ واقعی تبدیل می‌کنیم و تکراری‌ها را رد می‌کنیم.
    const created = await prisma.listing.createMany({
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
      skipDuplicates: true,
    });
    const total = await prisma.listing.count();
    console.log(`بذر دیتابیس انجام شد: ${created.count} آگهی تازه ریخته شد، در کل ${total} آگهی هست.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
