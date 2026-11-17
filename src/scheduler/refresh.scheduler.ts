// این فایل ساعت‌شمار بنگاه است؛ کار تکرارشونده‌ی تازه‌سازی را در صف ثبت می‌کند.
// وقتی برنامه روشن می‌شود، یک بار می‌گوید «هر چند دقیقه یک بار، یک دور تازه بگیر»
// و صف (`BullMQ` — بول‌ام‌کیو) همان را هر بار سر وقتش انجام می‌دهد.
// همان لحظه‌ی روشن شدن هم یک دور تازه‌سازی می‌گیریم، چون کار زمان‌بندی‌شده
// اولین دورش را دو ساعت بعد می‌زند و تا آن موقع لیست هنوز همان آگهی‌های قدیمی است.
// فاصله‌ی زمانی از `REFRESH_INTERVAL_MINUTES` (ریفرش اینتروال مینیتس) خوانده می‌شود؛ پیش‌فرض ۱۲۰ دقیقه.
// اگر ردیس خواب باشد، برنامه نمی‌ایستد؛ فقط ثبت کار نشد و با یک هشدار نوشته می‌شود.

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class RefreshScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefreshScheduler.name);

  constructor(@InjectQueue('refresh') private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    const minutes = Number(process.env.REFRESH_INTERVAL_MINUTES ?? 120) || 120;
    try {
      // ثبت کار تکرارشونده؛ اگر از قبل ثبت شده باشد، همان را به‌روز می‌کند و دو تا نمی‌شود.
      // اگر ردیس ده ثانیه جواب نداد، بی‌خیال می‌شویم تا روشن شدن برنامه گیر نکند.
      await this.withTimeout(
        this.queue.upsertJobScheduler(
          'scheduled-refresh',
          { every: minutes * 60_000 },
          { name: 'refresh-listings' },
        ),
        10_000,
      );
      this.logger.log(`تازه‌سازی خودکار ثبت شد: هر ${minutes} دقیقه یک بار.`);
    } catch (error) {
      this.logger.warn(
        `ثبت کار زمان‌بندی‌شده‌ی تازه‌سازی نشد (ردیس در دسترس نیست؟): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      // یک بار هم همان لحظه‌ی روشن شدن برنامه، یک دور تازه می‌گیریم؛
      // چون کار زمان‌بندی‌شده اولین دورش را دو ساعت بعد می‌زند و تا آن موقع
      // لیست هنوز همان آگهی‌های قدیمی دیتابیس است.
      // شماره‌ی کار را خود صف می‌سازد تا هر بار روشن شدن، کار خودش را داشته باشد.
      await this.withTimeout(this.queue.add('refresh-listings', {}), 10_000);
      this.logger.log('تازه‌سازی اول بعد از روشن شدن برنامه در صف گذاشته شد.');
    } catch (error) {
      this.logger.warn(
        `تازه‌سازی اول بعد از روشن شدن نشد (ردیس در دسترس نیست؟): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // یک قول را با مهلت اجرا می‌کند؛ اگر مهلت گذشت، خطای مهلت می‌دهد.
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) =>
        setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
      ),
    ]);
  }
}
