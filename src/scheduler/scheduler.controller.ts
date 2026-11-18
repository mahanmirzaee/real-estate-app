// این فایل درِ ورودی زمان‌بندی است؛ وضعیت تایمر تازه‌سازی را می‌دهد.
// صفحه از همین آدرس می‌پرسد «تازه‌سازی بعدی کی است؟» و «آخرین دور چه شد؟».

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshSchedulerService, SchedulerStatus } from './refresh-scheduler.service';

@ApiTags('scheduler — زمان‌بندی')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: RefreshSchedulerService) {}

  // وضعیت زمان‌بندی؛ فاصله‌ی بین دو تازه‌سازی، وقت تازه‌سازی بعدی،
  // وقت آخرین دور و نتیجه‌ی آخرین دور.
  @Get('status')
  @ApiOperation({ summary: 'وضعیت زمان‌بندی تازه‌سازی؛ وقت دور بعدی و نتیجه‌ی دور آخر' })
  @ApiResponse({ status: 200, description: 'وضعیت زمان‌بندی' })
  status(): Promise<SchedulerStatus> {
    return this.schedulerService.status();
  }
}
