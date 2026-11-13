// این فایل تلفن‌چی بنگاه را روشن می‌کند: سرور `MCP` (ام‌سی‌پی).
// `MCP` یعنی «پروتکل متن مدل» (`Model Context Protocol` — مدل کانتکست پروتکل)؛
// راهی است که هوش مصنوعی با آن می‌تواند ابزارهای برنامه‌ی ما را صدا بزند.
// مهم‌ترین نکته: این سرور هیچ منطقی از خودش ندارد؛ فقط همان سرویس‌هایی را صدا می‌زند
// که سایت اینترنتی (`REST API` — رست ای‌پی‌آی) هم صدا می‌زند. پس منطق فقط یک جاست.

// نکته‌ی فنی مهم: این سرور از راه متن (`stdio` — استاندارد ورودی/خروجی) حرف می‌زند،
// پس هیچ‌چیز نباید در خروجی معمولی چاپ شود؛ همه‌ی پیام‌ها باید به خطا (`stderr`) بروند.
// به همین خاطر برنامه‌ی `NestJS` (نست‌جی‌اس) را بدون لاگ می‌سازیم.

import { NestFactory } from '@nestjs/core';
// مسیر کوتاه زیر در زمان اجرا با نقشه‌ی خروجی خود پکیج حل می‌شود؛
// تایپ‌اسکریپت هم از راه نگاشت `paths` در `tsconfig.json` همان فایل واقعی را پیدا می‌کند.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AppModule } from '../app.module';
import { ConvertService } from '../convert/convert.service';
import { ListingsService } from '../listings/listings.service';

async function main(): Promise<void> {
  // برنامه‌ی `NestJS` را بدون لاگ می‌سازیم تا خروجی معمولی تمیز بماند.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  // همان سرویس‌هایی را می‌گیریم که سایت اینترنتی هم از آن‌ها استفاده می‌کند؛ بدون تکرار منطق.
  const listingsService = app.get(ListingsService);
  const convertService = app.get(ConvertService);

  const server = new McpServer({ name: 'realestate-mcp', version: '1.0.0' });

  // ابزار اول: جست‌وجوی آگهی‌های ذخیره‌شده؛ مثلاً آگهی‌های مهران را بده.
  server.tool(
    'search-listings',
    'آگهی‌های ذخیره‌شده‌ی دیوار را برمی‌گرداند؛ با محله می‌شود فقط همان محله را گرفت.',
    {
      district: z.string().optional().describe('نام محله؛ مثل مهران یا دبستان'),
      limit: z.number().optional().describe('حداکثر چند آگهی برگردد؛ پیش‌فرض ۲۰ تا'),
    },
    async ({ district, limit }) => {
      const all = listingsService.findAll(district);
      const chosen = all.slice(0, limit ?? 20);
      const text =
        chosen.length === 0
          ? 'هنوز آگهی‌ای ذخیره نشده است؛ اول باید با POST /listings/refresh یک دور تازه از دیوار گرفت.'
          : JSON.stringify(chosen, null, 2);
      return { content: [{ type: 'text', text }] };
    },
  );

  // ابزار دوم: تبدیل رهن کامل به رهن کمتر + اجاره‌ی ماهانه.
  server.tool(
    'convert-deposit',
    'رهن کامل را به رهن کمتر به‌علاوه‌ی اجاره‌ی ماهانه تبدیل می‌کند.',
    {
      rahn: z.number().positive().describe('مبلغ رهن کامل به تومان؛ مثل 3000000000'),
      keep: z.number().min(0).optional().describe('مبلغ رهنی که نگه داشته می‌شود؛ پیش‌فرض صفر'),
    },
    async ({ rahn, keep }) => {
      try {
        const result = convertService.convert(rahn, keep ?? 0);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'خطای نامشخص در تبدیل';
        return { content: [{ type: 'text', text: message }], isError: true };
      }
    },
  );

  // ابزار سوم: جزئیات یک آگهی با شناسه‌اش.
  server.tool(
    'get-listing',
    'جزئیات یک آگهی ذخیره‌شده را با شناسه‌اش برمی‌گرداند.',
    {
      token: z.string().describe('شناسه‌ی آگهی در دیوار؛ مثل AXvPb7p1'),
    },
    async ({ token }) => {
      const listing = listingsService.findOne(token);
      const text = listing
        ? JSON.stringify(listing, null, 2)
        : `آگهی با شناسه‌ی ${token} پیدا نشد.`;
      return { content: [{ type: 'text', text }] };
    },
  );

  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  // خطا را به خطا می‌فرستیم، نه به خروجی معمولی، تا حرف زدن با هوش مصنوعی خراب نشود.
  console.error(error);
  process.exit(1);
});
