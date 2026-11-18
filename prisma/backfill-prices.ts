// این فایل قیمت آگهی‌های قدیمی را یک بار می‌خواند و عددهایشان را پر می‌کند.
// آگهی‌های قدیمی وقتی ذخیره شدند هنوز قیمت خوانده نمی‌شد؛ پس رهن و اجاره‌شان خالی است.
// این اسکریپت متن قیمت ذخیره‌شده‌ی هر آگهی را با همان خواننده‌ی قیمت می‌خواند
// و عددها را می‌نویسد؛ فقط جاهای خالی را پر می‌کند و به عددی که از قبل هست دست نمی‌زند.
// اجرا، فقط یک بار: `npx ts-node prisma/backfill-prices.ts`

// اول فایل `.env` را می‌خوانیم تا آدرس دیتابیس در محیط برنامه باشد.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { parsePrice } from '../src/listings/price-parser';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('متغیر DATABASE_URL در فایل .env نیست');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const rows = await prisma.listing.findMany({
      select: { token: true, priceText: true, category: true, rahnAmount: true, ejareAmount: true },
    });
    let filled = 0;
    let skipped = 0;
    for (const row of rows) {
      // اگر هر دو عدد از قبل هست، کاری نداریم.
      if (row.rahnAmount !== null && row.ejareAmount !== null) {
        skipped++;
        continue;
      }
      const parsed = parsePrice(row.priceText, row.category);
      // فقط جاهای خالی را با عدد تازه پر می‌کنیم؛ عددی که هست، سر جایش می‌ماند.
      const data: { rahnAmount?: number | null; ejareAmount?: number | null } = {};
      if (row.rahnAmount === null && parsed.rahnAmount !== null) {
        data.rahnAmount = parsed.rahnAmount;
      }
      if (row.ejareAmount === null && parsed.ejareAmount !== null) {
        data.ejareAmount = parsed.ejareAmount;
      }
      if (Object.keys(data).length === 0) {
        skipped++;
        continue;
      }
      await prisma.listing.update({ where: { token: row.token }, data });
      filled++;
    }
    const withAmounts = await prisma.listing.count({
      where: { rahnAmount: { not: null }, ejareAmount: { not: null } },
    });
    console.log(`پر کردن قیمت تمام شد: ${filled} آگهی عدد گرفت، ${skipped} آگهی دست نخورد، در کل ${withAmounts} آگهی هر دو عدد را دارند.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
