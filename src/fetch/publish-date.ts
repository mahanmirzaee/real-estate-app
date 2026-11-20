// این فایل تاریخ انتشار آگهی را از زبان منبع درمی‌آورد؛
 // دیوار تاریخ را به فارسی می‌نویسد («۲۲ آبان ۱۴۰۵، ۲۰:۴۳») و شیپور
 // به میلادی («2026-11-09 08:11:51»)؛ هر دو به یک متن `ISO` (آی‌اس‌او) برمی‌گردند
 // تا در دیتابیس کنار `fetchedAt` (اولین دیده‌شدن) بنشیند.
 // اگر منبع تاریخ نداد، خالی برمی‌گردد و هیچ‌چیز حدس زده نمی‌شود.

import { normalizePersianDigits } from '../listings/price-parser';

// اسم ماه‌های جلالی به شماره‌شان؛ «آبان» یعنی ماه هشتم.
const JALALI_MONTHS: Record<string, number> = {
  فروردین: 1,
  اردیبهشت: 2,
  خرداد: 3,
  تیر: 4,
  مرداد: 5,
  شهریور: 6,
  مهر: 7,
  آبان: 8,
  آذر: 9,
  دی: 10,
  بهمن: 11,
  اسفند: 12,
};

// تبدیل تاریخ جلالی به میلادی؛ الگوریتم استاندارد تقویم جلالی
// (همان که کتابخانه‌های جلالی استفاده می‌کنند، با جدول نقطه‌های شکست).
// روز و ماه و سال جلالی می‌گیرد و روز و ماه و سال میلادی برمی‌گرداند.
function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  // نقطه‌های شکست چرخه‌ی کبیسه‌ی جلالی؛ از الگوریتم استاندارد است، نه حدس.
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
    2394, 2456, 3178,
  ];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jmBreak = breaks[i];
    jump = jmBreak - jp;
    if (jy < jmBreak) {
      break;
    }
    leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = jmBreak;
  }
  const n = jy - jp;
  leapJ += Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
  if (jump % 33 === 4 && jump - n === 4) {
    leapJ += 1;
  }
  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  const march = 20 + leapJ - leapG;
  // روزهای گذشته از اول فروردین تا این روز.
  let dayOfYear = (jm <= 6 ? (jm - 1) * 31 : (jm - 1) * 30 + 6) + (jd - 1);
  // روز میلادیِ اول فروردینِ همین سال؛ از آن جلو می‌رویم.
  const gregorianMarch = new Date(Date.UTC(gy, 2, march));
  const target = new Date(gregorianMarch.getTime() + dayOfYear * 24 * 60 * 60 * 1000);
  return [target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate()];
}

// تاریخ انتشار دیوار را از متن صفحه‌ی آگهی درمی‌آورد؛
 // مثل «انتشار آگهی: ۲۲ آبان ۱۴۰۵، ۲۰:۴۳».
 // ساعت تهران است؛ پس ساعت را با اختلاف تهران (`+03:30` — سه و نیم ساعت) می‌نویسیم
 // تا در دیتابیس به‌درستی ذخیره شود. اگر متن تاریخ نداشت، خالی برمی‌گردد.
export function parseDivarPublishDate(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const clean = normalizePersianDigits(text);
  const match =
    /انتشار آگهی:\s*(\d{1,2})\s+([^\s،]+)\s+(\d{4})\s*،?\s*(\d{1,2}):(\d{2})?/.exec(clean);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = JALALI_MONTHS[match[2]];
  const year = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 0;
  const minute = match[5] ? Number(match[5]) : 0;
  if (!month || day < 1 || day > 31 || year < 1300 || year > 1500 || hour > 23 || minute > 59) {
    return null;
  }
  const [gy, gm, gd] = jalaliToGregorian(year, month, day);
  const two = (n: number): string => String(n).padStart(2, '0');
  // ساعت را با اختلاف تهران می‌نویسیم تا `new Date` در برنامه آن را درست بخواند.
  return `${gy}-${two(gm)}-${two(gd)}T${two(hour)}:${two(minute)}:00+03:30`;
}

// تاریخ اضافه‌شدن شیپور را از جزئیات آگهی درمی‌آورد؛
 // مثل «2026-11-09 08:11:51.3474». اگر شکلش درست نبود، خالی برمی‌گردد.
export function parseSheypoorAddedAt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const clean = String(value).trim().replace(' ', 'T');
  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
