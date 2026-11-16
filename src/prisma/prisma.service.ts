// این فایل وصل شدن به دیتابیس را نگه می‌دارد؛ یعنی یک «مشتری» دیتابیس.
// هر کس در برنامه به دیتابیس نیاز داشته باشد، از همین یک مشتری استفاده می‌کند؛
// مشتری دومی ساخته نمی‌شود.

// در `Prisma` (پریزما) ۷، مشتری دیتابیس بدون «آداپتور» وصل نمی‌شود؛
// آداپتور همان راننده‌ای است که حرف زدن با `PostgreSQL` (پستگرس‌کیوال) را بلد است.
// آدرس دیتابیس را از متغیر `DATABASE_URL` در فایل `.env` می‌خوانیم.

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('متغیر DATABASE_URL در فایل .env نیست');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  // وقتی برنامه روشن می‌شود، به دیتابیس وصل می‌شویم.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  // وقتی برنامه خاموش می‌شود، اتصال را تمیز قطع می‌کنیم.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
