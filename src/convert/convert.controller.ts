// این فایل درِ ورودی ماشین‌حساب است؛ درخواست تبدیل رهن به اجاره از اینجا رد می‌شود.

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConvertService } from './convert.service';

@ApiTags('convert — تبدیل رهن به اجاره')
@Controller('convert')
export class ConvertController {
  constructor(private readonly convertService: ConvertService) {}

  // مثال: /convert?rahn=3000000000&keep=1000000000
  // یعنی رهن کامل ۳ میلیارد و نگه داشتن ۱ میلیارد؛ جواب: ماهی ۶۰ میلیون اجاره.
  // اگر keep را ندهیم، یعنی همه‌ی رهن به اجاره تبدیل می‌شود.
  @Get()
  @ApiOperation({ summary: 'تبدیل رهن کامل به اجاره‌ی ماهانه' })
  @ApiQuery({ name: 'rahn', description: 'رهن کامل به تومان', example: '3000000000' })
  @ApiQuery({ name: 'keep', required: false, description: 'رهن نگه‌داشته‌شده به تومان؛ اگر ندهی، صفر است', example: '1000000000' })
  @ApiResponse({ status: 200, description: 'جواب تبدیل: رهن تبدیل‌شده و اجاره‌ی ماهانه' })
  @ApiResponse({ status: 400, description: 'عددها اشتباه‌اند؛ مثلاً رهن نگه‌داشته‌شده بیشتر از رهن کامل است' })
  convert(@Query('rahn') rahn?: string, @Query('keep') keep?: string) {
    const fullRahn = Number(rahn);
    const keepRahn = keep === undefined ? 0 : Number(keep);
    return this.convertService.convert(fullRahn, keepRahn);
  }
}
