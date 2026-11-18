// این فایل سه میز بنگاه را کنار هم می‌چیند و یک برنامه می‌سازد.
// هر میز فقط کار خودش را می‌کند و با میزهای دیگر فقط از راه مشخص حرف می‌زند.

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { ConvertModule } from './convert/convert.module';
import { FetchModule } from './fetch/fetch.module';
import { ListingsModule } from './listings/listings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [AuthModule, ClientsModule, FetchModule, ListingsModule, ConvertModule, SchedulerModule, NotificationsModule, SettingsModule],
})
export class AppModule {}
