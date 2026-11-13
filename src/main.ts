// این فایل درِ ورودی برنامه است؛ وقتی برنامه را روشن می‌کنیم، از اینجا شروع می‌شود.

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('برنامه‌ی املاک روی http://localhost:3000 بالا آمد');
}

bootstrap();
