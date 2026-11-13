// این فایل درِ ورودی ماشین‌حساب است؛ درخواست تبدیل رهن به اجاره از اینجا رد می‌شود.

import { Controller, Get, Query } from '@nestjs/common';
import { ConvertService } from './convert.service';

@Controller('convert')
export class ConvertController {
  constructor(private readonly convertService: ConvertService) {}

  // مثال: /convert?rahn=3000000000&keep=1000000000
  // یعنی رهن کامل ۳ میلیارد و نگه داشتن ۱ میلیارد؛ جواب: ماهی ۶۰ میلیون اجاره.
  // اگر keep را ندهیم، یعنی همه‌ی رهن به اجاره تبدیل می‌شود.
  @Get()
  convert(@Query('rahn') rahn?: string, @Query('keep') keep?: string) {
    const fullRahn = Number(rahn);
    const keepRahn = keep === undefined ? 0 : Number(keep);
    return this.convertService.convert(fullRahn, keepRahn);
  }
}
