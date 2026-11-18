// این فایل دفترچه‌ی «آخرین تازه‌سازی» است؛ نتیجه‌ی آخرین دور تازه‌سازی را
// در حافظه نگه می‌دارد تا صفحه و دکمه‌ی «وضعیت زمان‌بندی» بتوانند نشانش دهند.
// دیتابیس لازم ندارد؛ اگر برنامه خاموش و روشن شود، فقط «آخرین تازه‌سازی» پاک می‌شود
// و با اولین دور تازه، دوباره پر می‌شود.

import { Injectable } from '@nestjs/common';

// آگهی تازه‌ای که به درد یک مشتری می‌خورد؛
  // بعد از هر تازه‌سازی، چت وضعیت از روی همین‌ها می‌گوید «این آگهی به درد مشتری X می‌خوره».
export interface ClientMatch {
  // شناسه‌ی مشتری در دفترچه.
  clientId: number;
  // اسم مشتری.
  clientName: string;
  // شناسه‌ی آگهی تازه.
  token: string;
  // تیتر آگهی تازه.
  title: string;
}

// نتیجه‌ی یک دور تازه‌سازی؛ همان چهار عدد نسخه‌ی چهارم،
// به‌علاوه‌ی «از هر منبع چند تا» تا صفحه بتواند بنویسد «چند تا از دیوار، چند تا از شیپور».
export interface RefreshResult {
  // چند آگهی خام از دو منبع گرفته شد.
  fetched: number;
  // چند آگهی تازه به انبار اضافه شد.
  added: number;
  // چند آگهی آژانس رد شد.
  skippedAgency: number;
  // حالا در کل چند آگهی در انبار هست.
  total: number;
  // از هر منبع چند آگهی خام گرفته شد.
  fetchedBySource: { divar: number; sheypoor: number };
  // از هر منبع چند آگهی تازه اضافه شد.
  addedBySource: { divar: number; sheypoor: number };
  // آگهی‌های تازه‌ای که به درد مشتری‌های دفترچه می‌خورند؛ اگر مشتری‌ای نباشد، خالی است.
  clientMatches?: ClientMatch[];
}

// یک دور تازه‌سازی با وقتش؛ همان نتیجه، به‌علاوه‌ی «کی انجام شد».
export interface LastRefresh extends RefreshResult {
  // وقتی که این دور تازه‌سازی انجام شد، به شکل متن (`ISO` — آی‌اس‌او).
  at: string;
}

@Injectable()
export class RefreshStatusService {
  // آخرین تازه‌سازی؛ اول خالی است تا اولین دور انجام شود.
  private last: LastRefresh | null = null;

  // نتیجه‌ی یک دور تازه‌سازی را با وقتش ثبت می‌کند؛
  // هم دور خودکار (از کارگر) و هم دور دستی (از دکمه‌ی تازه‌سازی) اینجا ثبت می‌شوند.
  record(result: RefreshResult): void {
    this.last = { ...result, at: new Date().toISOString() };
  }

  // آخرین تازه‌سازی را می‌دهد؛ اگر هنوز هیچ دوری انجام نشده، خالی است.
  getLast(): LastRefresh | null {
    return this.last;
  }
}
