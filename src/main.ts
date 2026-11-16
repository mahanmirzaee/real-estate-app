// این فایل درِ ورودی برنامه است؛ وقتی برنامه را روشن می‌کنیم، از اینجا شروع می‌شود.
// اول فایل `.env` را می‌خوانیم تا آدرس دیتابیس در محیط برنامه باشد.

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // صفحه‌ی `Swagger` (سواگر): سند زنده‌ی همه‌ی آدرس‌ها، روی http://localhost:3000/api
  // از همین صفحه می‌شود هر آدرس را با دکمه امتحان کرد، بدون `curl` (کرل).
  const config = new DocumentBuilder()
    .setTitle('پروژه‌ی املاک ماهان')
    .setDescription('جست‌وجوی آگهی دیوار، فیلتر آگهی شخصی و تبدیل رهن به اجاره')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
  console.log('برنامه‌ی املاک روی http://localhost:3000 بالا آمد');
  console.log('صفحه‌ی سواگر روی http://localhost:3000/api است');
}

bootstrap();
