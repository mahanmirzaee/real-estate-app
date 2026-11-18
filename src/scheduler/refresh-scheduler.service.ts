// این فایل ساعت‌شمار بنگاه است؛ کار تکرارشونده‌ی تازه‌سازی را در صف ثبت می‌کند،
// دوباره زمان‌بندی‌اش می‌کند و وضعیتش را می‌دهد.
// فاصله‌ی زمانی از `REFRESH_INTERVAL_MINUTES` (ریفرش اینتروال مینیتس) خوانده می‌شود؛ پیش‌فرض ۳۰ دقیقه.

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LastRefresh, RefreshStatusService } from './refresh-status.service';

// وضعیت زمان‌بندی؛ همان چیزی که تایمر صفحه و دکمه‌ی «وضعیت» نشان می‌دهند.
export interface SchedulerStatus {
  // فاصله‌ی بین دو تازه‌سازی خودکار، به دقیقه؛ پیش‌فرض ۳۰.
  intervalMinutes: number;
  // وقتی که تازه‌سازی خودکار بعدی انجام می‌شود؛ اگر کاری ثبت نشده باشد، خالی است.
  nextRunAt: string | null;
  // وقتی که آخرین دور تازه‌سازی انجام شد؛ اگر هنوز هیچ دوری نبوده، خالی است.
  lastRunAt: string | null;
  // نتیجه‌ی آخرین دور تازه‌سازی؛ اگر هنوز هیچ دوری نبوده، خالی است.
  lastRefresh: LastRefresh | null;
}

@Injectable()
export class RefreshSchedulerService {
  private readonly logger = new Logger(RefreshSchedulerService.name);
  // فاصله‌ی بین دو تازه‌سازی، به دقیقه؛ از متغیر محیطی می‌آید و پیش‌فرضش ۳۰ است.
  private readonly intervalMinutes: number;

  constructor(
    @InjectQueue('refresh') private readonly queue: Queue,
    private readonly statusService: RefreshStatusService,
  ) {
    this.intervalMinutes = Number(process.env.REFRESH_INTERVAL_MINUTES ?? 30) || 30;
  }

  // فاصله‌ی بین دو تازه‌سازی، به دقیقه.
  getIntervalMinutes(): number {
    return this.intervalMinutes;
  }

  // کار تکرارشونده را ثبت می‌کند؛ اگر از قبل ثبت شده باشد، همان را به‌روز می‌کند و دو تا نمی‌شود.
  // اگر ردیس ده ثانیه جواب نداد، خطا می‌دهد تا روشن شدن برنامه گیر نکند؛
  // کسی که صدا می‌زند تصمیم می‌گیرد چه کند.
  async register(): Promise<void> {
    await this.withTimeout(
      this.queue.upsertJobScheduler(
        'scheduled-refresh',
        { every: this.intervalMinutes * 60_000 },
        { name: 'refresh-listings' },
      ),
      10_000,
    );
    this.logger.log(`تازه‌سازی خودکار ثبت شد: هر ${this.intervalMinutes} دقیقه یک بار.`);
  }

  // تایمر را از اول می‌اندازد؛ یعنی کار قدیمی را برمی‌دارد و کار تازه‌ای ثبت می‌کند،
  // پس تازه‌سازی بعدی دقیقاً یک فاصله‌ی کامل (۳۰ دقیقه) بعد انجام می‌شود.
  // دکمه‌ی «تازه‌سازی» بعد از اینکه دور دستی را گرفت، همین را صدا می‌زند.
  async reschedule(): Promise<void> {
    try {
      await this.withTimeout(this.queue.removeJobScheduler('scheduled-refresh'), 10_000);
    } catch (error) {
      this.logger.warn(
        `برداشتن کار زمان‌بندی‌شده‌ی قدیمی نشد: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await this.register();
  }

  // وضعیت زمان‌بندی را می‌دهد؛ تایمر صفحه از همین استفاده می‌کند.
  async status(): Promise<SchedulerStatus> {
    let nextRunAt: string | null = null;
    try {
      const schedulers = await this.withTimeout(this.queue.getJobSchedulers(), 10_000);
      // در `BullMQ` (بول‌ام‌کیو) نسخه‌ی ۶، شناسه‌ی کار زمان‌بندی‌شده در فیلد `key` (کی) است، نه `id` (آی‌دی)؛
      // هر دو را می‌پرسیم تا اگر نسخه عوض شد، باز هم پیدا شود.
      const found = schedulers.find(
        (item) => (item as { key?: string; id?: string }).key === 'scheduled-refresh'
          || (item as { key?: string; id?: string }).id === 'scheduled-refresh',
      );
      // `next` (نکست) یعنی «دفعه‌ی بعد کی»؛ به شکل عدد میلی‌ثانیه است و به متن تاریخ برمی‌گردد.
      nextRunAt = found && typeof found.next === 'number' ? new Date(found.next).toISOString() : null;
    } catch (error) {
      this.logger.warn(
        `خواندن وضعیت زمان‌بندی نشد: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const last = this.statusService.getLast();
    return {
      intervalMinutes: this.intervalMinutes,
      nextRunAt,
      lastRunAt: last ? last.at : null,
      lastRefresh: last,
    };
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
