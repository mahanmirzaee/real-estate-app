// این فایل کارگر تازه‌سازی است؛ کاری که از صف می‌رسد را انجام می‌دهد.
// به این می‌گویند `WorkerHost` (ورکر هاست): کسی که کنار صف می‌ایستد و
// هر وقت کاری رسید، همان یک کار را انجام می‌دهد و نتیجه را می‌نویسد.
// منطق تازه‌سازی همین‌جا نیست؛ فقط همان سرویس آگهی‌ها را صدا می‌زند که
// دکمه‌ی دستی `POST /listings/refresh` (پست لیستینگز ریفرش) هم صدا می‌زند —
// پس راه تازه‌سازی فقط یکی است، چه دستی چه خودکار.

import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ListingsService } from '../listings/listings.service';
import { RefreshResult, RefreshStatusService } from './refresh-status.service';

@Processor('refresh')
export class RefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(RefreshProcessor.name);

  constructor(
    private readonly listingsService: ListingsService,
    private readonly statusService: RefreshStatusService,
  ) {
    super();
  }

  // هر کاری که از صف «تازه‌سازی» رسید، همین یک دور تازه‌سازی است.
  async process(job: Job): Promise<RefreshResult> {
    this.logger.log(`کار تازه‌سازی شروع شد (شماره‌ی کار: ${job.id}).`);
    const result = await this.listingsService.refresh();
    // نتیجه را در دفترچه‌ی «آخرین تازه‌سازی» می‌نویسیم تا صفحه و تایمر نشانش دهند.
    this.statusService.record(result);
    this.logger.log(
      `کار تازه‌سازی تمام شد: ${result.fetched} آگهی گرفته شد، ${result.added} تازه اضافه شد، ${result.skippedAgency} آژانس رد شد، در کل ${result.total} آگهی هست.`,
    );
    return result;
  }
}
