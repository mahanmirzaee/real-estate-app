// این فایل جعبه‌ی ردیس است؛ سرویس ردیس را می‌سازد و به جعبه‌های دیگر می‌دهد.
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
