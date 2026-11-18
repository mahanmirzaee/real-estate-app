// این فایل عددهای قیمت را از متن قیمت آگهی درمی‌آورد؛ مثل یک حسابدار که فاکتور را می‌خواند.
// قیمت آگهی فقط یک متن است («ودیعه: ۴۰۰,۰۰۰,۰۰۰ تومان، اجاره: ۴۰,۰۰۰,۰۰۰ تومان»)؛
// این فایل از همان متن، عدد رهن و عدد اجاره را جدا می‌کند تا بشود با آن‌ها حساب کرد.
// قانون طلایی: اگر چیزی خوانده نشد، حدس نمی‌زنیم — خالی برمی‌گردانیم و آگهی
// از جست‌وجوی بودجه کنار می‌ماند. عدد اشتباه، بدتر از نداشتن عدد است.

// نتیجه‌ی خواندن یک قیمت؛ هر سه عدد به تومان‌اند و اگر خوانده نشوند، خالی‌اند.
export interface ParsedPrice {
  // رهن (ودیعه)؛ برای «رهن کامل» هم همین عدد ودیعه است.
  rahnAmount: number | null;
  // اجاره‌ی ماهانه؛ برای «رهن کامل» صفر است (یعنی واقعاً اجاره ندارد)، نه خالی.
  ejareAmount: number | null;
  // قیمت فروش (قیمت کل)؛ فقط برای دسته‌های خرید پر می‌شود.
  // برای اجاره خالی است؛ آنجا رهن و اجاره را داریم.
  saleAmount: number | null;
}

// ارقام فارسی (۰-۹) و عربی (٠-٩) را به لاتین (0-9) برمی‌گرداند؛
// جداکننده‌ی اعشار فارسی (٫) را به نقطه تبدیل می‌کند؛
// جداکننده‌های هزارگان (، و ٬) را برمی‌دارد تا عدد یک‌تکه شود.
// جاهای دیگر برنامه هم همین کار را می‌خواهند (مثلاً خواندن جمله‌ی مشتری)،
// پس این تابع بیرون داده شده تا همه از یکی استفاده کنند.
export function normalizePersianDigits(text: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let out = '';
  for (const char of text) {
    const faIndex = persian.indexOf(char);
    if (faIndex >= 0) {
      out += String(faIndex);
      continue;
    }
    const arIndex = arabic.indexOf(char);
    if (arIndex >= 0) {
      out += String(arIndex);
      continue;
    }
    out += char;
  }
  return out
    .replace(/٫/g, '.')
    .replace(/[,٬]/g, '');
}

// ارقام فارسی (۰-۹) و عربی (٠-٩) را به لاتین (0-9) برمی‌گرداند؛
// جداکننده‌ی اعشار فارسی (٫) را به نقطه تبدیل می‌کند؛
// جداکننده‌های هزارگان (، و ٬) را برمی‌دارد تا عدد یک‌تکه شود.
function normalizeDigits(text: string): string {
  return normalizePersianDigits(text);
}

// از یک تکه متن، عدد را درمی‌آورد؛ مثل «۴۰۰,۰۰۰,۰۰۰ تومان» می‌شود 400000000،
// «۱٫۵ میلیارد تومان» می‌شود 1500000000، «۲ میلیارد و ۵۰۰ میلیون تومان» می‌شود 2500000000،
// و «توافقی» خالی برمی‌گردد چون عددی ندارد.
function readAmount(chunk: string): number | null {
  const clean = normalizeDigits(chunk);
  // همه‌ی جفت‌های «عدد + واحد» را پیدا می‌کنیم و با هم جمع می‌کنیم؛
  // این‌طوری «۲ میلیارد و ۵۰۰ میلیون» هم درست خوانده می‌شود.
  const pairs = [...clean.matchAll(/(\d+(?:\.\d+)?)\s*(میلیارد|میلیون)?/g)];
  if (pairs.length === 0) {
    return null;
  }
  let total = 0;
  for (const pair of pairs) {
    const value = parseFloat(pair[1]);
    if (!Number.isFinite(value)) {
      return null;
    }
    if (pair[2] === 'میلیارد') {
      total += value * 1_000_000_000;
    } else if (pair[2] === 'میلیون') {
      total += value * 1_000_000;
    } else {
      total += value;
    }
  }
  const rounded = Math.round(total);
  return Number.isFinite(rounded) && rounded >= 0 ? rounded : null;
}

// عددِ بعد از یک برچسب را پیدا می‌کند؛ مثلاً بعد از «ودیعه:» یا «اجاره:».
// تکه‌ی متن را تا جداکننده‌ی بعدی (،) می‌بُرد و عددش را می‌خواند.
function findAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const match = new RegExp(`${label}\\s*:?\\s*([^،|]+)`).exec(text);
    if (match) {
      const amount = readAmount(match[1]);
      if (amount !== null) {
        return amount;
      }
    }
  }
  return null;
}

// قیمت فروش (قیمت کل) را می‌خواند؛ مثل «قیمت کل: ۱۱٬۰۰۰٬۰۰۰٬۰۰۰ تومان».
// اول «قیمت کل» را می‌پرسیم؛ اگر نبود، «قیمت» ساده را.
// «قیمت هر متر» قیمت کل نیست و رد می‌شود — آن عدد متری است، نه قیمت خانه.
// اگر هیچ برچسبی نبود (مثل قیمت دیوار که فقط «۳۰,۰۰۰,۰۰۰,۰۰۰ تومان» است)،
// کل متن را یک عدد می‌خوانیم؛ «توافقی» عددی ندارد و خالی برمی‌گردد.
function findSaleAmount(text: string): number | null {
  const total = /قیمت کل\s*:?\s*([^،|]+)/.exec(text);
  if (total) {
    const amount = readAmount(total[1]);
    if (amount !== null) {
      return amount;
    }
  }
  const plain = /قیمت\s*:?\s*([^،|]+)/.exec(text);
  if (plain && !plain[1].includes('هر متر')) {
    const amount = readAmount(plain[1]);
    if (amount !== null) {
      return amount;
    }
  }
  // قیمت بدون برچسب؛ فقط وقتی متن برچسب دیگری ندارد.
  if (!/ودیعه|رهن|اجاره|قیمت|هر متر/.test(text)) {
    return readAmount(text);
  }
  return null;
}

// قیمت یک آگهی را می‌خواند.
// فقط دسته‌های اجاره رهن/اجاره دارند؛ دسته‌های خرید و زمین قیمت فروش دارند،
// نه رهن — پس برای آن‌ها قیمت فروش خوانده می‌شود و رهن/اجاره خالی می‌مانند.
// رهن را اول از «ودیعه» می‌خوانیم و اگر نبود از «رهن»؛
// «رهن کامل» یعنی اجاره صفر است؛ اگر هیچ‌کدام خوانده نشد، خالی برمی‌گردد.
export function parsePrice(priceText: string, category: string): ParsedPrice {
  if (!category.endsWith('-rent')) {
    return { rahnAmount: null, ejareAmount: null, saleAmount: findSaleAmount(priceText ?? '') };
  }
  const text = priceText ?? '';
  const rahnAmount = findAmount(text, ['ودیعه', 'رهن']);
  let ejareAmount = findAmount(text, ['اجاره']);
  if (ejareAmount === null && /رهن کامل/.test(text)) {
    ejareAmount = 0;
  }
  return { rahnAmount, ejareAmount, saleAmount: null };
}
