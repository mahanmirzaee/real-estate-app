// این فایل میز سوم بنگاه را سر هم می‌کند؛ یعنی «تبدیل قیمت» را.

import { Module } from '@nestjs/common';
import { ConvertController } from './convert.controller';
import { ConvertService } from './convert.service';

@Module({
  controllers: [ConvertController],
  providers: [ConvertService],
  // سرویس تبدیل را به جعبه‌های دیگر هم می‌دهیم؛ سرور `MCP` (ام‌سی‌پی) از همین استفاده می‌کند.
  exports: [ConvertService],
})
export class ConvertModule {}
