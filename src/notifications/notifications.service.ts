// این فایل خواننده‌ی دفتر رویدادها (اوت‌باکس) است؛ یعنی کسی که اعلان‌ها را می‌خواند.
// آگهی تازه وقتی به انبار اضافه شد، یک رویداد هم کنارش در دفتر نوشته شد؛
// این سرویس فقط همان دفتر را می‌خواند — نه دیوار را، نه شیپور را.
// رویداد تا وقتی خوانده نشده، «تازه» حساب می‌شود و در لیست اعلان‌ها می‌آید.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// شکل یک اعلان؛ یعنی یک رویداد به‌علاوه‌ی خود آگهی که داخل رویداد است.
export interface NotificationItem {
  // شناسه‌ی رویداد در دفتر.
  id: number;
  // نوع رویداد؛ فعلاً همیشه 'listing.created' است.
  eventType: string;
  // وقتی رویداد نوشته شد.
  createdAt: string;
  // فیلدهای خود آگهی، از داخل رویداد بیرون کشیده شده‌اند.
  token: string;
  title: string;
  priceText: string;
  district: string;
  category: string;
  categoryLabel: string;
  url: string;
  isPersonal: boolean;
  source: string;
  fetchedAt: string;
  imageUrl: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // همه‌ی رویدادهای خوانده‌نشده را برمی‌گرداند؛ تازه‌ترین اول.
  // هر رویداد، خود آگهی را هم همراهش دارد.
  async findUnprocessed(): Promise<NotificationItem[]> {
    const events = await this.prisma.outboxEvent.findMany({
      where: { processedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return events.map((event) => {
      const listing = event.payload as Record<string, unknown>;
      return {
        id: event.id,
        eventType: event.eventType,
        createdAt: event.createdAt.toISOString(),
        token: String(listing.token ?? ''),
        title: String(listing.title ?? ''),
        priceText: String(listing.priceText ?? ''),
        district: String(listing.district ?? ''),
        category: String(listing.category ?? ''),
        categoryLabel: String(listing.categoryLabel ?? ''),
        url: String(listing.url ?? ''),
        isPersonal: listing.isPersonal === true,
        source: String(listing.source ?? ''),
        fetchedAt: String(listing.fetchedAt ?? ''),
        imageUrl: listing.imageUrl ? String(listing.imageUrl) : null,
      };
    });
  }

  // همه‌ی رویدادهای خوانده‌نشده را «خوانده شد» می‌کند؛
  // یعنی روی همه‌شان مهر زمان خواندن می‌خورد و دیگر در لیست نمی‌آیند.
  // برمی‌گرداند چند تا خوانده شد.
  async readAll(): Promise<{ read: number }> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { processedAt: null },
      data: { processedAt: new Date() },
    });
    return { read: result.count };
  }
}
