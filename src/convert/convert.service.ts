// این فایل ماشین‌حساب بنگاه است: رهن کامل را می‌گیرد و می‌گوید با رهن کمتر،
// ماهی چقدر اجاره می‌شود. این فایل هیچ‌چیز از دیوار و آگهی نمی‌داند؛
// فقط با عدد کار می‌کند.

// ⚠️ هشدار خیلی مهم — قبل از خواندن بقیه‌ی فایل، این را بخوان:
// عدد ۳٪ پایین، حدس دستیار است، نه عدد واقعی بازار ماهان!
// ماهان هنوز نسبت واقعی تبدیل را نگفته است. وقتی او نسبت واقعی را گفت،
// فقط همین یک عدد را در همین یک جا عوض می‌کنیم و همه‌جای برنامه درست می‌شود.
// به همین خاطر این عدد فقط و فقط اینجاست و هیچ‌جای دیگر برنامه نیست.

// نسبت تبدیل رهن به اجاره‌ی ماهانه؛ یعنی هر ۱۰۰ تومان رهن، ماهی ۳ تومان اجاره می‌شود.
export const RAHN_TO_EJARE_RATIO = 0.03;

import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class ConvertService {
  // رهن کامل را می‌گیرد و رهن نگه‌داشته‌شده را از آن کم می‌کند؛
  // باقی‌مانده را با نسبت بالا به اجاره‌ی ماهانه تبدیل می‌کند.
  // مثال: رهن کامل ۳٬۰۰۰٬۰۰۰٬۰۰۰ با نگه داشتن ۱٬۰۰۰٬۰۰۰٬۰۰۰
  // یعنی ۲٬۰۰۰٬۰۰۰٬۰۰۰ تومان تبدیل می‌شود و ماهی ۶۰٬۰۰۰٬۰۰۰ تومان اجاره می‌شود.
  convert(fullRahn: number, keepRahn = 0): {
    fullRahn: number;
    keepRahn: number;
    convertedRahn: number;
    ejareMonthly: number;
    ratio: number;
  } {
    if (!Number.isFinite(fullRahn) || fullRahn <= 0) {
      throw new BadRequestException('مبلغ رهن کامل باید عددی بزرگ‌تر از صفر باشد');
    }
    if (!Number.isFinite(keepRahn) || keepRahn < 0) {
      throw new BadRequestException('رهن نگه‌داشته‌شده نمی‌تواند منفی باشد');
    }
    if (keepRahn > fullRahn) {
      throw new BadRequestException('رهن نگه‌داشته‌شده نمی‌تواند از رهن کامل بیشتر باشد');
    }
    // باقی‌مانده‌ی رهن که می‌خواهیم به اجاره تبدیلش کنیم.
    const convertedRahn = fullRahn - keepRahn;
    // عدد را گرد می‌کنیم تا خرده‌های اعشاری کامپیوتر در جواب نیاید.
    const ejareMonthly = Math.round(convertedRahn * RAHN_TO_EJARE_RATIO);
    return { fullRahn, keepRahn, convertedRahn, ejareMonthly, ratio: RAHN_TO_EJARE_RATIO };
  }
}
