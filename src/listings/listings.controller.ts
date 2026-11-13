// این فایل درِ ورودی میز دوم است؛ درخواست‌های اینترنتی به آگهی‌ها از اینجا رد می‌شوند.
// `Controller` (کنترلر) یعنی دربان؛ درخواست را می‌گیرد و جواب را پس می‌دهد.

import { Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  // همه‌ی آگهی‌های ذخیره‌شده؛ مثلاً /listings?district=مهران فقط آگهی‌های مهران را می‌دهد.
  @Get()
  findAll(@Query('district') district?: string) {
    return this.listingsService.findAll(district);
  }

  // یک آگهی با شناسه‌اش؛ مثلاً /listings/AXvPb7p1
  @Get(':token')
  findOne(@Param('token') token: string) {
    const listing = this.listingsService.findOne(token);
    if (!listing) {
      throw new NotFoundException(`آگهی با شناسه‌ی ${token} پیدا نشد`);
    }
    return listing;
  }

  // یک دور تازه از دیوار می‌گیرد و تازه‌ها را ذخیره می‌کند.
  @Post('refresh')
  refresh() {
    return this.listingsService.refresh();
  }
}
