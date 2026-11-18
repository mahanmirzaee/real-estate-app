// این فایل متراژ آگهی را از تیتر یا متنش درمی‌آورد؛ مثل اینکه بخوانی
// «آپارتمان ۸۰ متری» و بگویی ۸۰ متر است.
// قانون طلایی مثل قیمت است: اگر چیزی خوانده نشد، حدس نمی‌زنیم — خالی برمی‌گردد.

import { normalizePersianDigits } from './price-parser';

// متراژ را از متن درمی‌آورد؛ مثل «۸۰ متری»، «متراژ ۱۲۰»، «۱۲۰ متر مربع».
// «۱۲۰ متر تا مترو» متراژ نیست و رد می‌شود؛ «مترو» فاصله تا مترو است، نه مساحت خانه.
// عدد باید بین ۱۰ تا ۵۰۰۰ باشد؛ بیرون این بازه، یا اشتباه خوانده شده یا متراژ نیست.
export function extractArea(text: string | null | undefined): number | null {
  if (!text || text.trim().length === 0) {
    return null;
  }
  const clean = normalizePersianDigits(text);
  // اول «متراژ: ۱۲۰» را می‌پرسیم؛ صریح‌ترین شکل است.
  const labeled = /متراژ\s*:?\s*(\d+(?:\.\d+)?)/.exec(clean);
  if (labeled) {
    const value = parseFloat(labeled[1]);
    if (Number.isFinite(value) && value >= 10 && value <= 5000) {
      return Math.round(value);
    }
  }
  // بعد «۸۰ متری» یا «۱۲۰ متر» یا «۱۲۰ متر مربع»؛
  // اگر بعد از «متر»، «مترو» یا «تا» آمد، آن متراژ نیست و رد می‌شود.
  const pattern = /(\d+(?:\.\d+)?)\s*متر(ی| مربع|مربع)?(?![\w\u0600-\u06FF])/g;
  for (const match of clean.matchAll(pattern)) {
    const after = clean.slice(match.index + match[0].length, match.index + match[0].length + 12).trim();
    if (after.startsWith('مترو') || after.startsWith('تا')) {
      continue;
    }
    const value = parseFloat(match[1]);
    if (Number.isFinite(value) && value >= 10 && value <= 5000) {
      return Math.round(value);
    }
  }
  return null;
}
