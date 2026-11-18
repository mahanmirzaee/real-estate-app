// این فایل انبار آگهی‌هاست؛ تنها جایی که با دیتابیس حرف می‌زند.
// بقیه‌ی کد هیچ‌وقت مستقیم سراغ دیتابیس نمی‌رود؛ فقط به این فایل می‌گوید
// «ذخیره کن» یا «بده». این همان قرارداد `ListingsRepository` (ریپازیتوری) است،
// ولی این بار پیاده‌سازیش با دیتابیس است، نه فایل `JSON` (جیسون).

import { Injectable } from '@nestjs/common';
import { Listing as PrismaListing, Prisma } from '@prisma/client';
import { Listing, ListingFeatures } from '../fetch/listing.interface';
import { PrismaService } from '../prisma/prisma.service';
import { featuresFromJson } from './features';
import { ListingsRepository } from './listings.repository';

// امکانات را به شکل `JSON` (جیسون) خام برمی‌گرداند تا پریزما قبولش کند؛
// اگر امکانات نبود، خالی برمی‌گردانیم تا ستون خالی بماند.
function featuresToJson(features: ListingFeatures | null | undefined): Prisma.InputJsonValue | undefined {
  if (!features) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(features)) as Prisma.InputJsonValue;
}

// لیست رشته‌ها را به شکل `JSON` (جیسون) خام برمی‌گرداند تا پریزما قبولش کند؛
// اگر لیست خالی بود، خالی برمی‌گردانیم تا ستون خالی بماند.
function stringArrayToJson(values: string[] | null | undefined): Prisma.InputJsonValue | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(values)) as Prisma.InputJsonValue;
}

// چیزی که از دیتابیس (ستون `JSON` — جیسون) می‌آید را به لیست رشته برمی‌گرداند؛
// اگر شکلش درست نبود، خالی برمی‌گرداند تا کارت خراب نشود.
function stringArrayFromJson(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const out = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return out.length > 0 ? out : null;
}

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
      imageUrl: row.imageUrl ?? null,
      // عکس‌های گالری؛ اگر منبع بیش از یک عکس داده باشد، همه اینجاست.
      imageUrls: stringArrayFromJson(row.imageUrls),
      rahnAmount: row.rahnAmount ?? null,
      ejareAmount: row.ejareAmount ?? null,
      // قیمت فروش و متراژ؛ اگر خوانده نشده باشند، خالی‌اند.
      saleAmount: row.saleAmount ?? null,
      areaSqm: row.areaSqm ?? null,
      // وضعیت و یادداشت را جدا پر می‌کنیم؛ اینجا خالی می‌ماند تا `findAll` پرش کند.
      status: null,
      note: null,
      // متن کامل آگهی؛ اگر وقتی ذخیره شد متن نداشت (آگهی قدیمی)، خالی است.
      description: row.description ?? null,
      // امکانات را از ستون `JSON` (جیسون) برمی‌گردانیم؛ اگر شکلش درست نبود، خالی است.
      features: featuresFromJson(row.features),
    };
  }

  // همه‌ی آگهی‌های ذخیره‌شده را برمی‌گرداند؛ قدیمی‌ها اول، تازه‌ها آخر —
  // دقیقاً همان ترتیبی که قبلاً با فایل بود.
  // وضعیت و یادداشت هر آگهی هم رویش می‌نشیند؛ اگر وضعیتی نبود، خالی می‌ماند.
  async findAll(): Promise<Listing[]> {
    const [rows, statuses] = await Promise.all([
      this.prisma.listing.findMany({
        orderBy: [{ fetchedAt: 'asc' }, { id: 'asc' }],
      }),
      this.findStatuses(),
    ]);
    return rows.map((row) => {
      const listing = this.toListing(row);
      const saved = statuses.get(row.token);
      if (saved) {
        listing.status = saved.status;
        listing.note = saved.note;
      }
      return listing;
    });
  }

  // یک آگهی را با شناسه‌اش پیدا می‌کند؛ اگر نبود، خالی برمی‌گرداند.
  async findByToken(token: string): Promise<Listing | undefined> {
    const row = await this.prisma.listing.findUnique({ where: { token } });
    if (!row) {
      return undefined;
    }
    const listing = this.toListing(row);
    const saved = await this.prisma.listingStatus.findUnique({ where: { token } });
    if (saved) {
      listing.status = saved.status;
      listing.note = saved.note;
    }
    return listing;
  }

  // وضعیت و یادداشت یک آگهی را ذخیره می‌کند؛ اگر وضعیت خالی باشد، ردیفش پاک می‌شود.
  // اگر یادداشت داده نشده باشد، یادداشت قبلی سر جایش می‌ماند.
  async saveStatus(
    token: string,
    status: string | null,
    note?: string | null,
  ): Promise<{ token: string; status: string | null; note: string | null }> {
    if (status === null) {
      await this.prisma.listingStatus.deleteMany({ where: { token } });
      return { token, status: null, note: null };
    }
    const existing = await this.prisma.listingStatus.findUnique({ where: { token } });
    const nextNote = note === undefined ? (existing?.note ?? null) : note;
    const saved = await this.prisma.listingStatus.upsert({
      where: { token },
      create: { token, status, note: nextNote },
      update: { status, note: nextNote },
    });
    return { token, status: saved.status, note: saved.note ?? null };
  }

  // همه‌ی وضعیت‌ها و یادداشت‌ها را می‌دهد؛ کلیدشان شناسه‌ی آگهی است.
  async findStatuses(): Promise<Map<string, { status: string; note: string | null }>> {
    const rows = await this.prisma.listingStatus.findMany();
    const out = new Map<string, { status: string; note: string | null }>();
    for (const row of rows) {
      out.set(row.token, { status: row.status, note: row.note ?? null });
    }
    return out;
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
          imageUrl: listing.imageUrl ?? null,
          imageUrls: stringArrayToJson(listing.imageUrls),
          rahnAmount: listing.rahnAmount ?? null,
          ejareAmount: listing.ejareAmount ?? null,
          saleAmount: listing.saleAmount ?? null,
          areaSqm: listing.areaSqm ?? null,
          description: listing.description ?? null,
          features: featuresToJson(listing.features),
        })),
      }),
    ]);
  }

  // آگهی‌های تازه را به انبار اضافه می‌کند، ولی تکراری‌ها را دوباره ذخیره نمی‌کند؛
  // دیتابیس خودش با `skipDuplicates` (اسکیپ دوپلیکیتس) تکراری‌ها را رد می‌کند.
  // برای هر آگهی واقعاً تازه، یک رویداد «آگهی تازه آمد» هم در دفتر `Outbox` (اوت‌باکس)
  // نوشته می‌شود — در همان تراکنش، کنار خود آگهی؛ یعنی یا هر دو با هم نوشته می‌شوند
  // یا هیچ‌کدام. اگر وسط کار برنامه خاموش شود، هیچ آگهی‌ای بدون رویداد نمی‌ماند
  // و هیچ رویدادی هم برای آگهی‌ای که ذخیره نشده، ساخته نمی‌شود.
  async upsert(incoming: Listing[]): Promise<{
    added: number;
    addedBySource: { divar: number; sheypoor: number };
    total: number;
  }> {
    if (incoming.length === 0) {
      const total = await this.prisma.listing.count();
      return { added: 0, addedBySource: { divar: 0, sheypoor: 0 }, total };
    }
    // اول می‌پرسیم کدام شناسه‌ها از قبل در انبار هستند؛
    // فقط آگهی‌هایی که از قبل نیستند، «تازه» حساب می‌شوند و رویداد می‌گیرند.
    const existing = await this.prisma.listing.findMany({
      where: { token: { in: incoming.map((listing) => listing.token) } },
      select: { token: true },
    });
    const existingTokens = new Set(existing.map((row) => row.token));
    const fresh = incoming.filter((listing) => !existingTokens.has(listing.token));

    const created = await this.prisma.$transaction(async (tx) => {
      // آگهی‌های تازه را می‌نویسیم؛ تکراری‌ها را دیتابیس خودش رد می‌کند.
      const result = await tx.listing.createMany({
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
          imageUrl: listing.imageUrl ?? null,
          imageUrls: stringArrayToJson(listing.imageUrls),
          rahnAmount: listing.rahnAmount ?? null,
          ejareAmount: listing.ejareAmount ?? null,
          saleAmount: listing.saleAmount ?? null,
          areaSqm: listing.areaSqm ?? null,
          description: listing.description ?? null,
          features: featuresToJson(listing.features),
        })),
        skipDuplicates: true,
      });
      // آگهی‌هایی که از قبل بودند ولی عکس نداشتند، حالا که دوباره دیده شدند،
      // عکسشان را می‌گیرند تا لیست قدیمی هم کم‌کم عکس‌دار شود.
      for (const listing of incoming) {
        if (listing.imageUrl) {
          await tx.listing.updateMany({
            where: { token: listing.token, imageUrl: null },
            data: { imageUrl: listing.imageUrl },
          });
        }
      }
      // آگهی‌هایی که از قبل بودند ولی عدد رهن/اجاره ندارند (چون وقتی ذخیره شدند
      // هنوز قیمت خوانده نمی‌شد)، حالا که دوباره دیده شدند و قیمت تازه‌شان کامل است،
      // متن قیمت تازه‌شان را می‌گیرند و عددهایش را هم؛ تا جست‌وجوی بودجه آن‌ها را هم پیدا کند.
      // فقط وقتی قیمت تازه کامل است (هر دو عدد دارد) چیزی عوض می‌شود؛
      // عدد ناقص، جای عددی که از قبل هست را نمی‌گیرد.
      for (const listing of incoming) {
        if (listing.rahnAmount !== null && listing.rahnAmount !== undefined
          && listing.ejareAmount !== null && listing.ejareAmount !== undefined) {
          await tx.listing.updateMany({
            where: { token: listing.token, OR: [{ rahnAmount: null }, { ejareAmount: null }] },
            data: {
              priceText: listing.priceText,
              rahnAmount: listing.rahnAmount,
              ejareAmount: listing.ejareAmount,
            },
          });
        }
      }
      // آگهی‌هایی که از قبل بودند ولی متن کامل نداشتند (چون وقتی ذخیره شدند
      // هنوز متن گرفته نمی‌شد)، حالا که دوباره دیده شدند و متن تازه‌شان هست،
      // متن و امکاناتشان را می‌گیرند تا کارت‌های قدیمی هم آیکون داشته باشند.
      // فقط وقتی متن تازه هست چیزی عوض می‌شود؛ متن خالی، جای متن قبلی را نمی‌گیرد.
      for (const listing of incoming) {
        if (listing.description) {
          await tx.listing.updateMany({
            where: { token: listing.token, description: null },
            data: {
              description: listing.description,
              features: featuresToJson(listing.features),
            },
          });
        }
      }
      // آگهی‌هایی که از قبل بودند ولی عکس‌های گالری نداشتند، حالا که دوباره دیده شدند
      // و عکس تازه‌شان هست، عکس‌هایشان را می‌گیرند تا کارت‌های قدیمی هم گالری شوند.
      // برای ستون `JSON` (جیسون) نمی‌شود مستقیم `null` نوشت؛ باید گفت «برابر خالی جیسون است».
      for (const listing of incoming) {
        if (listing.imageUrls && listing.imageUrls.length > 0) {
          await tx.listing.updateMany({
            where: { token: listing.token, imageUrls: { equals: Prisma.JsonNull } },
            data: { imageUrls: stringArrayToJson(listing.imageUrls) },
          });
        }
      }
      // آگهی‌هایی که از قبل بودند ولی متراژ یا قیمت فروش نداشتند، حالا که دوباره دیده شدند
      // و عدد تازه‌شان هست، عددهایشان را می‌گیرند تا «متری» روی کارت‌های قدیمی هم بیاید.
      for (const listing of incoming) {
        const data: Record<string, number> = {};
        if (listing.areaSqm !== null && listing.areaSqm !== undefined) {
          data.areaSqm = listing.areaSqm;
        }
        if (listing.saleAmount !== null && listing.saleAmount !== undefined) {
          data.saleAmount = listing.saleAmount;
        }
        if (Object.keys(data).length === 0) {
          continue;
        }
        const where: Record<string, unknown> = { token: listing.token };
        const missing: Array<Record<string, null>> = [];
        if (data.areaSqm !== undefined) {
          missing.push({ areaSqm: null });
        }
        if (data.saleAmount !== undefined) {
          missing.push({ saleAmount: null });
        }
        await tx.listing.updateMany({ where: { ...where, OR: missing }, data });
      }
      // برای هر آگهی تازه، یک رویداد در دفتر اوت‌باکس می‌نویسیم؛
      // خود آگهی کامل، داخل رویداد هم هست تا خواننده لازم نباشد دوباره بپرسد.
      await tx.outboxEvent.createMany({
        data: fresh.map((listing) => ({
          eventType: 'listing.created',
          payload: {
            token: listing.token,
            title: listing.title,
            priceText: listing.priceText,
            district: listing.district,
            category: listing.category,
            categoryLabel: listing.categoryLabel,
            url: listing.url,
            isPersonal: listing.isPersonal,
            source: listing.source,
            fetchedAt: listing.fetchedAt,
            imageUrl: listing.imageUrl ?? null,
          },
        })),
      });
      return result;
    });
    const total = await this.prisma.listing.count();
    // آگهی‌های تازه‌ای که واقعاً اضافه شدند، به تفکیک منبع؛
    // همان لیست «تازه» است که قبل از نوشتن جدا کرده بودیم.
    const addedBySource = { divar: 0, sheypoor: 0 };
    for (const listing of fresh) {
      addedBySource[listing.source]++;
    }
    return { added: created.count, addedBySource, total };
  }
}
