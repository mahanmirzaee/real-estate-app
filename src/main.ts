// این فایل درِ ورودی برنامه است؛ وقتی برنامه را روشن می‌کنیم، از اینجا شروع می‌شود.
// اول فایل `.env` را می‌خوانیم تا آدرس دیتابیس در محیط برنامه باشد.

import 'dotenv/config';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createAuthMiddleware } from './auth/auth.middleware';
import { AuthService } from './auth/auth.service';

async function bootstrap(): Promise<void> {
  // `NestExpressApplication` (نست اکسپرس اپلیکیشن) یعنی برنامه‌ی وب با موتور `Express` (اکسپرس)؛
  // این نوع برنامه بلد است فایل‌های آماده (`public`) را هم بدهد، نه فقط آدرس‌های کد.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // نگهبان در: جلوی همه‌ی آدرس‌ها می‌ایستد و کوکی نشست را می‌بیند؛
  // فقط صفحه‌ی ورود (`/login` — لاگین) از آن رد می‌شود.
  // این میان‌افزار (میدل‌ویر) را جلوتر از فایل‌های آماده ثبت می‌کنیم،
  // تا صفحه‌ی اصلی هم پشت ورود باشد، نه فقط آدرس‌های کد.
  const authService = app.get(AuthService);
  app.use(createAuthMiddleware(authService));

  // صفحه‌ی گرافیکی «موتور جست‌وجوگر ماهان» از پوشه‌ی `public` (پابلیک) داده می‌شود؛
  // فایل `index.html` روی آدرس اصلی (/) باز می‌شود و بقیه‌ی آدرس‌ها سر جایشان می‌مانند.
  // `useStaticAssets` (یوز استتیک استس) یعنی: «فایل‌های آماده را مستقیم بده، بدون اینکه کد اجرا شود.»
  app.useStaticAssets(join(__dirname, '..', 'public'));

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
  console.log('موتور جست‌وجوگر ماهان روی http://localhost:3000 بالا آمد');
  console.log('صفحه‌ی سواگر روی http://localhost:3000/api است');
}

bootstrap();
