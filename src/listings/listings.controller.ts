// این فایل درِ ورودی میز دوم است؛ درخواست‌های اینترنتی به آگهی‌ها از اینجا رد می‌شوند.
// `Controller` (کنترلر) یعنی دربان؛ درخواست را می‌گیرد و جواب را پس می‌دهد.

import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  forwardRef,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RefreshSchedulerService } from '../scheduler/refresh-scheduler.service';
import { RefreshStatusService } from '../scheduler/refresh-status.service';
import { ListingsService } from './listings.service';

@ApiTags('listings — آگهی‌ها')
@Controller('listings')
export class ListingsController {
  private readonly logger = new Logger(ListingsController.name);

  constructor(
    private readonly listingsService: ListingsService,
    // ساعت‌شمار و دفترچه‌ی «آخرین تازه‌سازی» از جعبه‌ی زمان‌بندی می‌آیند؛
    // با `forwardRef` (فوروارد رف) وصل می‌شوند چون آن جعبه هم به ما نیاز دارد.
    @Inject(forwardRef(() => RefreshSchedulerService))
    private readonly schedulerService: RefreshSchedulerService,
    @Inject(forwardRef(() => RefreshStatusService))
    private readonly statusService: RefreshStatusService,
  ) {}

  // همه‌ی آگهی‌های ذخیره‌شده؛ مثلاً /listings?district=مهران فقط آگهی‌های مهران را می‌دهد.
  @Get()
  @ApiOperation({ summary: 'همه‌ی آگهی‌های شخصی ذخیره‌شده' })
  @ApiQuery({ name: 'district', required: false, description: 'فقط آگهی‌های این محله؛ مثلاً مهران', example: 'مهران' })
  @ApiResponse({ status: 200, description: 'لیست آگهی‌ها' })
  findAll(@Query('district') district?: string) {
    return this.listingsService.findAll(district);
  }

  // جست‌وجو بر اساس بودجه‌ی رهن؛ مثلاً /listings/budget?target=2000000000&max=2500000000
  // آگهی‌هایی را می‌دهد که «معادل رهن کامل» آن‌ها زیر سقف است؛ نزدیک‌ترین به هدف اول.
  // این آدرس باید بالاتر از آدرس `/:token` باشد، وگرنه کلمه‌ی `budget` به‌جای شناسه خوانده می‌شود.
  @Get('budget')
  @ApiOperation({ summary: 'جست‌وجوی آگهی شخصی بر اساس بودجه‌ی رهن کامل' })
  @ApiQuery({ name: 'target', description: 'رهن کامل مورد نظر به تومان؛ مثلاً 2000000000', example: 2000000000 })
  @ApiQuery({ name: 'max', description: 'حداکثر رهن کامل به تومان؛ هیچ آگهی‌ای بالای این سقف نمی‌آید', example: 2500000000 })
  @ApiResponse({ status: 200, description: 'آگهی‌ها با معادل رهن کامل، نزدیک‌ترین به هدف اول' })
  @ApiResponse({ status: 400, description: 'عدد هدف یا سقف درست نیست' })
  findByBudget(@Query('target') targetRaw?: string, @Query('max') maxRaw?: string) {
    const target = Number(targetRaw);
    const max = Number(maxRaw);
    if (!Number.isFinite(target) || target <= 0) {
      throw new BadRequestException('عدد هدف (target) باید عددی بزرگ‌تر از صفر باشد');
    }
    if (!Number.isFinite(max) || max <= 0) {
      throw new BadRequestException('عدد سقف (max) باید عددی بزرگ‌تر از صفر باشد');
    }
    if (max < target) {
      throw new BadRequestException('سقف (max) نمی‌تواند از هدف (target) کمتر باشد');
    }
    return this.listingsService.findByBudget(target, max);
  }

  // یک آگهی با شناسه‌اش؛ مثلاً /listings/AXvPb7p1
  @Get(':token')
  @ApiOperation({ summary: 'یک آگهی با شناسه‌اش' })
  @ApiParam({ name: 'token', description: 'شناسه‌ی آگهی', example: 'ga3T0wlp' })
  @ApiResponse({ status: 200, description: 'آگهی پیدا شد' })
  @ApiResponse({ status: 404, description: 'آگهی با این شناسه پیدا نشد' })
  async findOne(@Param('token') token: string) {
    const listing = await this.listingsService.findOne(token);
    if (!listing) {
      throw new NotFoundException(`آگهی با شناسه‌ی ${token} پیدا نشد`);
    }
    return listing;
  }

  // یک دور تازه از دیوار می‌گیرد و تازه‌ها را ذخیره می‌کند؛
  // بعد تایمر خودکار را هم از اول می‌اندازد، یعنی تازه‌سازی بعدی ۳۰ دقیقه بعد از همین لحظه است،
  // و نتیجه را در دفترچه‌ی «آخرین تازه‌سازی» می‌نویسد تا چت وضعیت نشانش دهد.
  // اگر تایمر از اول انداخته نشد (مثلاً ردیس خواب بود)، خود دور تازه سالم برگشته است؛
  // فقط تایمر سر جایش می‌ماند و با یک هشدار نوشته می‌شود.
  @Post('refresh')
  @ApiOperation({ summary: 'یک دور تازه از دیوار؛ گرفتن آگهی‌های جدید' })
  @ApiResponse({ status: 201, description: 'چند آگهی گرفته شد، چند تا تازه اضافه شد، چند تا آژانس بود' })
  async refresh() {
    const result = await this.listingsService.refresh();
    this.statusService.record(result);
    try {
      await this.schedulerService.reschedule();
    } catch (error) {
      this.logger.warn(
        `تایمر تازه‌سازی از اول انداخته نشد: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return result;
  }
}
