// این فایل میز اعلان‌ها را سر هم می‌کند؛ یعنی «خواندن دفتر رویدادها و نشان دادن اعلان‌ها».

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  // برای خواندن دفتر رویدادها به ماژول دیتابیس نیاز داریم.
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
