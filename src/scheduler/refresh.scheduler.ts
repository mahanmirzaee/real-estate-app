// این فایل روشن شدن برنامه را مدیریت می‌کند؛ وقتی برنامه روشن می‌شود،
// کار تکرارشونده‌ی تازه‌سازی را ثبت می‌کند و همان لحظه یک دور تازه هم می‌گیرد.
// فاصله‌ی زمانی از `REFRESH_INTERVAL_MINUTES` (ریفرش اینتروال مینیتس) خوانده می‌شود؛ پیش‌فرض ۳۰ دقیقه.
// اگر ردیس خواب باشد، برنامه نمی‌ایستد؛ فقط ثبت کار نشد و با یک هشدار نوشته می‌شود.

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RefreshSchedulerService } from './refresh-scheduler.service';

@Injectable()
export class RefreshScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefreshScheduler.name);

  constructor(
    @InjectQueue('refresh') private readonly queue: Queue,
    private readonly schedulerService: RefreshSchedulerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      // کار تکرارشونده را ثبت می‌کنیم؛ اگر از قبل ثبت شده باشد، همان را به‌روز می‌کند و دو تا نمی‌شود.
      await this.schedulerService.register();
    } catch (error) {
      this.logger.warn(
        `ثبت کار زمان‌بندی‌شده‌ی تازه‌سازی نشد (ردیس در دسترس نیست؟): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      // یک بار هم همان لحظه‌ی روشن شدن برنامه، یک دور تازه می‌گیریم؛
      // چون کار زمان‌بندی‌شده اولین دورش را ۳۰ دقیقه بعد می‌زند و تا آن موقع
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
