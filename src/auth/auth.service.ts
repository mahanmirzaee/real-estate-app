// این فایل ورود به برنامه است؛ کد ۶ رقمی را می‌گیرد و نشست (جلسه‌ی ورود) می‌سازد.
// کد در دیتابیس، خوانا ذخیره شده است؛ یعنی ماهان می‌تواند آن را از دیتابیس بخواند
// (مثلاً با `pgAdmin` — پی‌جی‌ادمین) و وارد شود.
// نشست روی سرور نگه داشته می‌شود (در حافظه) و فقط یک شناسه‌ی تصادفی در کوکی مرورگر می‌رود؛
// پس کد ورود هرگز در مرورگر نمی‌ماند و با خاموش و روشن شدن برنامه، نشست‌ها پاک می‌شوند
// و باید دوباره وارد شد.

import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// کسی که وارد شده است؛ همین اسم بالای صفحه با خوش‌آمد نشان داده می‌شود.
export interface SessionUser {
  // شناسه‌ی کاربر در دیتابیس.
  id: number;
  // اسم کاربر؛ مثلاً «ماهان».
  name: string;
  // نقش کاربر؛ `user` (یوزر) یعنی کاربر معمولی، `admin` (ادمین) یعنی مدیر.
  // قسمت مدیر فعلاً خاموش است و نقش فقط برای بعد نگه داشته شده است.
  role: string;
}

// نام کوکی نشست؛ مرورگر همین یکی را نگه می‌دارد.
export const SESSION_COOKIE = 'mahan_session';

@Injectable()
export class AuthService {
  // نشست‌های فعال؛ کلید شناسه‌ی تصادفی کوکی است و مقدارش کسی که وارد شده است.
  // این‌ها فقط در حافظه‌ی برنامه‌اند؛ با خاموش شدن برنامه پاک می‌شوند.
  private readonly sessions = new Map<string, SessionUser>();

  constructor(private readonly prisma: PrismaService) {}

  // با کد ۶ رقمی وارد می‌شویم؛ اگر کد درست بود، یک نشست تازه می‌سازیم
  // و شناسه‌اش را برمی‌گردانیم تا در کوکی گذاشته شود.
  // اگر کد اشتباه بود، خالی برمی‌گردانیم.
  async login(code: string): Promise<{ token: string; user: SessionUser } | null> {
    const trimmed = (code ?? '').trim();
    if (!/^\d{6}$/.test(trimmed)) {
      return null;
    }
    const row = await this.prisma.appUser.findUnique({ where: { code: trimmed } });
    if (!row) {
      return null;
    }
    const user: SessionUser = { id: row.id, name: row.name, role: row.role };
    // شناسه‌ی نشست را تصادفی می‌سازیم؛ ۳۲ بایت تصادفی، یعنی حدس زدنش ممکن نیست.
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, user);
    return { token, user };
  }

  // از سربرگ کوکی مرورگر، کسی که وارد شده را پیدا می‌کند؛
  // اگر کوکی نبود یا نشستش پاک شده بود، خالی برمی‌گردانیم.
  userFromCookie(cookieHeader: string | undefined): SessionUser | null {
    const cookies = parseCookies(cookieHeader);
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      return null;
    }
    return this.sessions.get(token) ?? null;
  }

  // نشست را پاک می‌کند؛ یعنی خروج.
  logout(cookieHeader: string | undefined): void {
    const cookies = parseCookies(cookieHeader);
    const token = cookies[SESSION_COOKIE];
    if (token) {
      this.sessions.delete(token);
    }
  }
}

// سربرگ کوکی را به شکل «نام → مقدار» برمی‌گرداند؛
 // مثلاً `mahan_session=abc123; theme=dark` می‌شود `{ mahan_session: 'abc123', theme: 'dark' }`.
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) {
    return out;
  }
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.split('=');
    if (!key) {
      continue;
    }
    try {
      out[key.trim()] = decodeURIComponent(rest.join('=').trim());
    } catch {
      out[key.trim()] = rest.join('=').trim();
    }
  }
  return out;
}
