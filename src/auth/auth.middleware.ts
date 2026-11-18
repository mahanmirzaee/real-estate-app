// این فایل نگهبان درِ برنامه است؛ جلوی همه‌ی آدرس‌ها می‌ایستد و کوکی نشست را می‌بیند.
// اگر کسی وارد شده باشد، رد می‌شود؛ اگر نه، به صفحه‌ی ورود فرستاده می‌شود.
// فقط صفحه‌ی ورود (`/login` — لاگین) از این نگهبان رد می‌شود.
// این میان‌افزار (میدل‌ویر) در `main.ts` (مین) جلوتر از فایل‌های آماده (`public` — پابلیک)
// ثبت می‌شود، پس صفحه‌ی اصلی هم پشت ورود است، نه فقط آدرس‌های کد.

import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service';

// یک میان‌افزار `Express` (اکسپرس) می‌سازد که با سرویس ورود کار می‌کند.
export function createAuthMiddleware(auth: AuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // صفحه‌ی ورود، خودش درِ ورود است؛ نگهبان ندارد.
    if (req.path === '/login') {
      next();
      return;
    }
    const user = auth.userFromCookie(req.headers.cookie);
    if (user) {
      // کسی که وارد شده را روی درخواست می‌گذاریم تا کنترلرها بتوانند اسمش را بخوانند.
      (req as unknown as { user: typeof user }).user = user;
      next();
      return;
    }
    // اگر مرورگر صفحه می‌خواهد (مثل صفحه‌ی اصلی یا سواگر)، به صفحه‌ی ورود می‌فرستیم؛
    // اگر برنامه یا `fetch` (فچ) داده‌ی `JSON` (جیسون) می‌خواهد، خطای ۴۰۱ می‌دهیم.
    const wantsHtml = (req.headers.accept ?? '').includes('text/html');
    if (wantsHtml || req.path === '/' || req.path.endsWith('.html')) {
      res.redirect('/login');
      return;
    }
    res.status(401).json({ message: 'اول باید وارد شوید' });
  };
}
