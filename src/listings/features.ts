// این فایل از روی متن آگهی، امکاناتش را درمی‌آورد؛ مثل اینکه متن را بخوانی و
// بگویی «پارکینگ دارد؟ انباری دارد؟ آسانسور دارد؟» و «چه ویژگی خوبی دارد؟».
// هیچ‌چیز حدس زده نمی‌شود: اگر متن چیزی نگفته باشد، جواب «معلوم نیست» است.

// امکانات یک آگهی که از متن درآورده‌ایم.
// هر امکان سه حالت دارد: درست یعنی «دارد»، غلط یعنی «ندارد»، خالی یعنی «از روی متن معلوم نشد».
export interface ListingFeatures {
  // پارکینگ دارد؟ درست/غلط/خالی.
  parking: boolean | null;
  // انباری دارد؟ درست/غلط/خالی.
  storage: boolean | null;
  // آسانسور دارد؟ درست/غلط/خالی.
  elevator: boolean | null;
  // یک ویژگی خوب از متن؛ مثل «بالکن دارد» یا «خوش‌نقشه». اگر چیزی پیدا نشد، خالی است.
  highlight: string | null;
}

// متن را تمیز می‌کند تا کلمه‌ها راحت پیدا شوند:
// ی و ک عربی به فارسی برمی‌گردند، نیم‌فاصله برداشته می‌شود
// (پس «خوش‌نقشه» و «خوش نقشه» یکی می‌شوند) و فاصله‌های اضافه جمع می‌شوند.
function norm(text: string): string {
  return text
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\u200C/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// کلمه‌هایی که می‌گویند «این امکان را ندارد»؛ اگر متن یکی از این‌ها را داشته باشد،
// حتی اگر اسم آن امکان هم آمده باشد، جواب «ندارد» است.
// مثلاً «بدون پارکینگ» یعنی پارکینگ ندارد، نه اینکه دارد.
const NEGATIONS: Record<'parking' | 'storage' | 'elevator', string[]> = {
  parking: ['بدون پارکینگ', 'فاقد پارکینگ', 'پارکینگ ندارد', 'پارکینگ نداره'],
  storage: ['بدون انباری', 'فاقد انباری', 'انباری ندارد', 'انباری نداره'],
  elevator: ['بدون آسانسور', 'فاقد آسانسور', 'آسانسور ندارد', 'آسانسور نداره'],
};

// کلمه‌ی خود هر امکان در متن.
const FEATURE_WORDS: Record<'parking' | 'storage' | 'elevator', string[]> = {
  parking: ['پارکینگ'],
  storage: ['انباری'],
  elevator: ['آسانسور'],
};

// ویژگی‌های خوب، به ترتیب اولویت؛ اولین چیزی که در متن پیدا شود، همان نشان داده می‌شود.
// کلمه‌ی اول همان چیزی است که در متن دنبالش می‌گردیم، جمله‌ی دوم همان چیزی است که روی کارت می‌نویسیم.
const HIGHLIGHTS: Array<{ word: string; label: string }> = [
  { word: 'خوش‌نقشه', label: 'خوش‌نقشه' },
  { word: 'همسایگان خوب', label: 'همسایگان خوب' },
  { word: 'بالکن', label: 'بالکن دارد' },
  { word: 'تراس', label: 'تراس دارد' },
  { word: 'نورگیر', label: 'نورگیر' },
  { word: 'آفتاب‌گیر', label: 'آفتاب‌گیر' },
  { word: 'دلباز', label: 'دلباز' },
  { word: 'نوساز', label: 'نوساز' },
  { word: 'بازسازی شده', label: 'بازسازی شده' },
  { word: 'حیاط', label: 'حیاط دارد' },
  { word: 'ویو', label: 'ویو دارد' },
];

// از روی متن آگهی، امکانات را درمی‌آورد.
// اگر متن خالی باشد (آگهی قدیمی که متنش ذخیره نشده)، همه‌چیز خالی است؛
// یعنی «معلوم نیست»، نه «ندارد» — روی کارت خاکستری نشان داده می‌شود، نه قرمز.
export function extractFeatures(text: string | null | undefined): ListingFeatures {
  const empty: ListingFeatures = { parking: null, storage: null, elevator: null, highlight: null };
  if (!text || text.trim().length === 0) {
    return empty;
  }
  const clean = norm(text);
  const out: ListingFeatures = { ...empty };
  (Object.keys(FEATURE_WORDS) as Array<'parking' | 'storage' | 'elevator'>).forEach((key) => {
    // اول «ندارد»ها را می‌پرسیم؛ اگر بود، جواب غلط است.
    if (NEGATIONS[key].some((phrase) => clean.includes(norm(phrase)))) {
      out[key] = false;
      return;
    }
    // اگر خود کلمه بود، جواب درست است؛ اگر هیچ‌کدام نبود، جواب غلط است،
    // چون متن هست و آن امکان را نگفته است.
    out[key] = FEATURE_WORDS[key].some((word) => clean.includes(norm(word)));
  });
  // یک ویژگی خوب؛ اولین چیزی که در متن پیدا شود.
  const found = HIGHLIGHTS.find((item) => clean.includes(norm(item.word)));
  out.highlight = found ? found.label : null;
  return out;
}

// چیزی که از دیتابیس (ستون `JSON` — جیسون) می‌آید را به شکل امکانات برمی‌گرداند؛
// اگر شکلش درست نبود، خالی برمی‌گرداند تا کارت خراب نشود.
export function featuresFromJson(value: unknown): ListingFeatures | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const asBoolOrNull = (field: unknown): boolean | null =>
    field === true ? true : field === false ? false : null;
  return {
    parking: asBoolOrNull(raw.parking),
    storage: asBoolOrNull(raw.storage),
    elevator: asBoolOrNull(raw.elevator),
    highlight: typeof raw.highlight === 'string' && raw.highlight.length > 0 ? raw.highlight : null,
  };
}
