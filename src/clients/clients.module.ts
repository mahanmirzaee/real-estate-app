// این فایل جعبه‌ی دفترچه‌ی مشتری‌ها را سر هم می‌کند.
// `Module` (ماژول) یعنی یک جعبه که چند تا قطعه‌ی مرتبط را کنار هم نگه می‌دارد.

import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  // برای آگهی‌های مناسب هر مشتری، به جعبه‌ی آگهی‌ها نیاز داریم.
  imports: [PrismaModule, ListingsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
