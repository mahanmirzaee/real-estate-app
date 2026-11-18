// این فایل درِ ورودی اعلان‌هاست؛ درخواست‌های اینترنتی به اعلان‌ها از اینجا رد می‌شوند.
// `Controller` (کنترلر) یعنی دربان؛ درخواست را می‌گیرد و جواب را پس می‌دهد.

import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications — اعلان‌ها')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // همه‌ی اعلان‌های خوانده‌نشده؛ تازه‌ترین اول.
  @Get()
  @ApiOperation({ summary: 'اعلان‌های خوانده‌نشده؛ آگهی‌های تازه‌ای که هنوز ندیده‌ای' })
  @ApiResponse({ status: 200, description: 'لیست اعلان‌ها، تازه‌ترین اول' })
  findUnprocessed() {
    return this.notificationsService.findUnprocessed();
  }

  // همه‌ی اعلان‌ها را «خوانده شد» می‌کند؛ بعد از این، لیست اعلان‌ها خالی می‌شود.
  @Post('read-all')
  @ApiOperation({ summary: 'همه‌ی اعلان‌ها را خوانده‌شده علامت بزن' })
  @ApiResponse({ status: 201, description: 'چند اعلان خوانده شد' })
  readAll() {
    return this.notificationsService.readAll();
  }
}
