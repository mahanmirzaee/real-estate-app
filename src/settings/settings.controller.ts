// این فایل درِ ورودی تنظیمات است؛ محله‌ها از اینجا خوانده و عوض می‌شوند.
// `Controller` (کنترلر) یعنی دربان؛ درخواست را می‌گیرد و جواب را پس می‌دهد.

import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings — تنظیمات')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // فهرست محله‌های الان؛ می‌گوید پیش‌فرض‌اند یا ماهان عوضشان کرده است.
  @Get('districts')
  @ApiOperation({ summary: 'فهرست محله‌های پیکربندی‌شده برای جست‌وجو' })
  @ApiResponse({ status: 200, description: 'محله‌ها و اینکه پیش‌فرض‌اند یا نه' })
  getDistricts() {
    return this.settings.getDistricts();
  }

  // فهرست محله‌ها را کامل عوض می‌کند؛ اضافه و حذف، هر دو از همین راه‌اند.
  // هر محله شناسه‌ی عددی دیوار و اسم می‌خواهد؛ شناسه‌ی شیپور اختیاری است.
  // اگر به‌جای فهرست، یک اسم بدهی (`{ name, id? }`)، همان یک محله اضافه می‌شود؛
  // شناسه اگر داده نشد، از روی اسم شناخته‌شده پیدا می‌شود، وگرنه خطا می‌دهد.
  @Post('districts')
  @ApiOperation({ summary: 'جایگزینی فهرست محله‌ها یا اضافه کردن یک محله' })
  @ApiResponse({ status: 201, description: 'فهرست تازه‌ی محله‌ها' })
  async replaceDistricts(@Body() body: { districts?: unknown; name?: string; id?: string | number }) {
    try {
      if (body?.name !== undefined) {
        const added = await this.settings.addDistrict(body.name, body?.id ?? null);
        return { districts: added.districts, isDefault: false, resolvedId: added.resolvedId };
      }
      const districts = await this.settings.setDistricts(body?.districts);
      return { districts, isDefault: false };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'فهرست محله‌ها درست نیست');
    }
  }

  // یک محله را با شناسه‌اش حذف می‌کند؛ آخرین محله حذف نمی‌شود.
  @Delete('districts/:id')
  @ApiOperation({ summary: 'حذف یک محله از فهرست جست‌وجو' })
  @ApiResponse({ status: 200, description: 'فهرست باقی‌مانده' })
  async removeDistrict(@Param('id') id: string) {
    try {
      const districts = await this.settings.removeDistrict(id);
      return { districts, isDefault: false };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'حذف محله نشد');
    }
  }
}
