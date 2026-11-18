// این فایل جعبه‌ی ورود است؛ سرویس ورود و کنترلر ورود را سر هم می‌کند.
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // برای پیدا کردن کاربر با کدش، به ماژول دیتابیس نیاز داریم.
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService],
  // سرویس ورود را به `main.ts` (مین) هم می‌دهیم تا نگهبان در را با آن بسازد.
  exports: [AuthService],
})
export class AuthModule {}
