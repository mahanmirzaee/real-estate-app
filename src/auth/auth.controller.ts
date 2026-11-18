// این فایل درِ ورود برنامه است؛ صفحه‌ی ورود را می‌دهد و کد ۶ رقمی را می‌گیرد.
// `Controller` (کنترلر) یعنی دربان؛ درخواست را می‌گیرد و جواب را پس می‌دهد.

import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { join } from 'path';
import { AuthService, SESSION_COOKIE, SessionUser } from './auth.service';

@ApiTags('auth — ورود')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // صفحه‌ی ورود؛ فایل آماده‌ی `public/login.html` (لاگین اچ‌تی‌ام‌ال) را می‌دهد.
  @Get('login')
  @ApiOperation({ summary: 'صفحه‌ی ورود با کد ۶ رقمی' })
  loginPage(@Res() res: Response): void {
    res.sendFile(join(__dirname, '..', '..', 'public', 'login.html'));
  }

  // ورود با کد ۶ رقمی؛ اگر کد درست بود، کوکی نشست را می‌گذارد و اسم کاربر را برمی‌گرداند.
  // اگر کد اشتباه بود، خطای ۴۰۱ می‌دهد و دلیلش را نمی‌گوید که کد وجود ندارد یا اشتباه است؛
  // هر دو یکی است تا کسی نتواند حدس بزند کدام کدها در دیتابیس هستند.
  @Post('login')
  @ApiOperation({ summary: 'ورود با کد ۶ رقمی' })
  @ApiResponse({ status: 201, description: 'ورود انجام شد؛ کوکی نشست گذاشته شد' })
  @ApiResponse({ status: 401, description: 'کد اشتباه است' })
  async login(
    @Body() body: { code?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: boolean; name: string; role: string }> {
    const result = await this.authService.login(body?.code ?? '');
    if (!result) {
      res.status(401);
      return { ok: false, name: '', role: '' };
    }
    // کوکی نشست؛ فقط سرور می‌تواند بخواندش (`httpOnly` — اچ‌تی‌تی‌پی‌انلی)،
    // ۳۰ روز می‌ماند و بعد باید دوباره وارد شد.
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return { ok: true, name: result.user.name, role: result.user.role };
  }

  // خروج؛ نشست را پاک می‌کند و کوکی را هم از مرورگر برمی‌دارد.
  @Post('logout')
  @ApiOperation({ summary: 'خروج؛ نشست پاک می‌شود' })
  @ApiResponse({ status: 201, description: 'خروج انجام شد' })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): { ok: boolean } {
    this.authService.logout(req.headers.cookie);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  // کسی که وارد شده کیست؟ صفحه‌ی اصلی با این آدرس اسم را می‌گیرد و سلام می‌کند.
  @Get('auth/me')
  @ApiOperation({ summary: 'کسی که وارد شده کیست؛ اسم و نقش' })
  @ApiResponse({ status: 200, description: 'اسم و نقش کاربر واردشده' })
  me(@Req() req: Request): SessionUser | null {
    return (req as unknown as { user?: SessionUser }).user ?? null;
  }
}
