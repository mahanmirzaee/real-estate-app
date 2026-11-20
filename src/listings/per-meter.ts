// این فایل «متری» آگهی را حساب می‌کند؛ یعنی قیمت هر متر مربع.
// برای اجاره، قیمت کل همان «معادل رهن کامل» است (رهن + اجاره‌ای که با ۳٪ به رهن برگشته)؛
// برای خرید، قیمت کل همان قیمت فروش است. پس متری برای هر دو نوع معنی دارد:
// رهن ۲ میلیارد برای ۸۰ متر می‌شود متری ۲۵ میلیون، و فروش ۱۱ میلیارد برای ۴۳ متر
// می‌شود متری ۲۵۶ میلیون. میانگین محله هم جدا برای اجاره و جدا برای خرید حساب می‌شود،
// چون متری اجاره و متری خرید دو دنیای متفاوت‌اند و قاطی‌شان میانگین بی‌معنی می‌شود.

import { RAHN_TO_EJARE_RATIO } from '../convert/convert.service';
import { Listing } from '../fetch/listing.interface';
import { DistrictConfig } from '../settings/district-config';

// آگهی با فیلدهای محاسبه‌شده‌ی متری؛ همان آگهی است، به‌علاوه‌ی سه فیلد تازه.
// این فیلدها ذخیره نمی‌شوند؛ هر بار که لیست خوانده می‌شود، از نو حساب می‌شوند.
export interface ListingWithPerMeter extends Listing {
  // متری به تومان؛ اگر متراژ یا قیمت معلوم نباشد، خالی است.
  perMeter: number | null;
  // میانگین متری همان محله و همان نوع (اجاره یا خرید)؛ اگر آگهی دیگری در محله نباشد، خالی است.
  // این عدد میانه است، نه میانگین حسابی؛ و فقط وقتی نشان داده می‌شود که
  // حداقل ۳ آگهی با متراژ در آن محله و نوع باشد.
  districtAveragePerMeter: number | null;
  // چند آگهی در میانگین محله شمرده شده است؛ کنار میانگین نشان داده می‌شود.
  districtAverageCount: number | null;
  // آیا متری این آگهی بیش از ۱۰٪ زیر میانگین محله‌اش است؟ یعنی «زیر قیمت».
  belowAverage: boolean;
}

// میانه‌ی چند عدد؛ عدد وسط بعد از مرتب شدن.
// اگر تعداد زوج بود، میانگین دو عدد وسط. میانه مثل میانگین حسابی نیست:
// یک آگهی خیلی گرون یا خیلی ارزون، میانه را جابه‌جا نمی‌کند.
export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

// معادل رهن کامل یک آگهی اجاره؛ اگر رهن یا اجاره معلوم نباشد، خالی است.
export function equivalentRahnOf(listing: Listing): number | null {
  if (listing.rahnAmount === null || listing.rahnAmount === undefined) {
    return null;
  }
  if (listing.ejareAmount === null || listing.ejareAmount === undefined) {
    return null;
  }
  return Math.round(listing.rahnAmount + listing.ejareAmount / RAHN_TO_EJARE_RATIO);
}

// قیمت کل یک آگهی؛ برای اجاره معادل رهن کامل، برای خرید قیمت فروش.
// این همان عددی است که متری از رویش حساب می‌شود.
export function totalValueOf(listing: Listing): number | null {
  if (listing.category.endsWith('-rent')) {
    return equivalentRahnOf(listing);
  }
  if (listing.saleAmount === null || listing.saleAmount === undefined) {
    return null;
  }
  return listing.saleAmount;
}

// متری یک آگهی؛ قیمت کل تقسیم بر متراژ.
// اگر متراژ یا قیمت معلوم نباشد، خالی است و متری نشان داده نمی‌شود.
export function perMeterOf(listing: Listing): number | null {
  const total = totalValueOf(listing);
  if (total === null || total <= 0) {
    return null;
  }
  if (listing.areaSqm === null || listing.areaSqm === undefined || listing.areaSqm <= 0) {
    return null;
  }
  return Math.round(total / listing.areaSqm);
}

// محله را تمیز می‌کند تا بشود با هم مقایسه‌اش کرد:
// نیم‌فاصله و فاصله برداشته می‌شود و هرچه در پرانتز است کنار گذاشته می‌شود؛
// پس «سید خندان (جلفا)» و «سیدخندان» یکی می‌شوند.
export function normalizeDistrictName(name: string): string {
  return (name ?? '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\(.*?\)/g, '')
    .replace(/[\u200C\s]+/g, '')
    .trim();
}

// اسم‌های دیگری که همان محله‌اند؛ مثلاً «جلفا» در دیوار و شیپور
// گاهی «سید خندان» نوشته می‌شود، ولی همان محله است.
const DISTRICT_ALIASES: Record<string, string[]> = {
  جلفا: ['سیدخندان', 'سید خندان'],
};

// محله‌ی یک آگهی را به اسم محله‌ی پیکربندی‌شده برمی‌گرداند؛
// اگر محله‌اش در فهرست نبود، همان اسم خودش می‌ماند.
export function resolveDistrictName(listingDistrict: string, districts: DistrictConfig[]): string {
  const clean = normalizeDistrictName(listingDistrict);
  for (const district of districts) {
    const name = normalizeDistrictName(district.name);
    if (clean === name || clean.includes(name) || name.includes(clean)) {
      return district.name;
    }
    const aliases = DISTRICT_ALIASES[district.name] ?? [];
    if (aliases.some((alias) => clean.includes(normalizeDistrictName(alias)))) {
      return district.name;
    }
  }
  return listingDistrict;
}

// همه‌ی املاهای یک محله؛ اسم اصلی و اسم‌های مستعارش، هر دو طرف.
// مثلاً «جلفا» و «سید خندان» هر دو برمی‌گردند، هر کدام که داده شود.
export function districtSpellings(name: string): string[] {
  const clean = normalizeDistrictName(name);
  const out = new Set<string>();
  if (clean.length > 0) {
    out.add(clean);
  }
  for (const [canonical, aliases] of Object.entries(DISTRICT_ALIASES)) {
    const group = [canonical, ...aliases].map((item) => normalizeDistrictName(item));
    if (group.includes(clean)) {
      for (const spelling of group) {
        out.add(spelling);
      }
    }
  }
  return [...out];
}

// آیا این دو اسم، یک محله‌اند؟ فاصله و نیم‌فاصله و پرانتز مهم نیست،
// و اسم مستعار هم قبول است؛ «جلفا» با «سید خندان» یکی است، هر دو طرف.
export function sameDistrict(a: string, b: string): boolean {
  const cleanA = normalizeDistrictName(a);
  const cleanB = normalizeDistrictName(b);
  if (cleanA.length === 0 || cleanB.length === 0) {
    return false;
  }
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return true;
  }
  const spellingsA = districtSpellings(a);
  const spellingsB = districtSpellings(b);
  return spellingsA.some((spelling) => spellingsB.includes(spelling));
}

// نوع آگهی برای میانگین؛ 'rent' یعنی اجاره، 'buy' یعنی خرید.
export function kindGroupOf(listing: Listing): 'rent' | 'buy' {
  return listing.category.endsWith('-rent') ? 'rent' : 'buy';
}

// میانگین متری یک محله و یک نوع؛ از آگهی‌های ذخیره‌شده حساب می‌شود.
export interface DistrictAverage {
  // اسم محله؛ همان اسم پیکربندی‌شده.
  district: string;
  // نوع؛ اجاره یا خرید.
  kind: 'rent' | 'buy';
  // میانه‌ی متری به تومان؛ میانه است، نه میانگین حسابی.
  averagePerMeter: number;
  // چند آگهی در این میانگین شمرده شده است؛ کمتر از ۳ تا باشد، میانگینی نیست.
  count: number;
}

// میانگین متری هر محله و هر نوع را از لیست آگهی‌ها حساب می‌کند.
// فقط آگهی‌هایی که متری دارند شمرده می‌شوند؛
// اگر در یک محله و نوع کمتر از ۳ آگهی با متراژ باشد، میانگینی برای آن نیست،
// چون با یکی دو آگهی نمی‌شود گفت قیمت محله چقدر است.
export function districtAverages(
  listings: Listing[],
  districts: DistrictConfig[],
): DistrictAverage[] {
  const groups = new Map<string, number[]>();
  for (const listing of listings) {
    const perMeter = perMeterOf(listing);
    if (perMeter === null) {
      continue;
    }
    const key = `${resolveDistrictName(listing.district, districts)}|${kindGroupOf(listing)}`;
    const values = groups.get(key) ?? [];
    values.push(perMeter);
    groups.set(key, values);
  }
  const out: DistrictAverage[] = [];
  for (const [key, values] of groups) {
    if (values.length < 3) {
      continue;
    }
    const middle = median(values);
    if (middle === null) {
      continue;
    }
    const [district, kind] = key.split('|');
    out.push({
      district,
      kind: kind as 'rent' | 'buy',
      averagePerMeter: middle,
      count: values.length,
    });
  }
  return out;
}

// روی هر آگهی سه فیلد متری می‌گذارد: متری خودش، میانگین متری محله‌اش، و «زیر قیمت» بودن.
// «زیر قیمت» یعنی متری آگهی بیش از ۱۰٪ زیر میانه‌ی بقیه‌ی آگهی‌های همان محله و همان نوع است؛
// میانه‌ی بقیه حساب می‌شود، نه میانه‌ی با خودش، تا آگهی تنها در محله «زیر قیمت» نشود.
// `statsListings` (لیست آمار) همان آگهی‌هایی‌اند که میانگین از رویشان حساب می‌شود؛
// اگر داده نشد، همان لیست نمایشی است. در برنامه‌ی اصلی، لیست آمار همه‌ی آگهی‌هاست،
// یعنی شخصی و مشاور با هم، ولی لیست نمایشی فقط شخصی است.
export function enrichListings(
  listings: Listing[],
  districts: DistrictConfig[],
  statsListings?: Listing[],
): ListingWithPerMeter[] {
  const stats = statsListings ?? listings;
  const averages = districtAverages(stats, districts);
  const byKey = new Map(averages.map((item) => [`${item.district}|${item.kind}`, item]));
  // متری‌های هر گروه، برای میانه‌ی «بقیه»؛ خود آگهی موقع حساب از لیست کنار می‌رود.
  const groupValues = new Map<string, number[]>();
  for (const listing of stats) {
    const perMeter = perMeterOf(listing);
    if (perMeter === null) {
      continue;
    }
    const key = `${resolveDistrictName(listing.district, districts)}|${kindGroupOf(listing)}`;
    const values = groupValues.get(key) ?? [];
    values.push(perMeter);
    groupValues.set(key, values);
  }
  return listings.map((listing) => {
    const perMeter = perMeterOf(listing);
    const district = resolveDistrictName(listing.district, districts);
    const kind = kindGroupOf(listing);
    const average = byKey.get(`${district}|${kind}`) ?? null;
    let belowAverage = false;
    if (perMeter !== null && average !== null && average.count >= 3) {
      // میانه‌ی بقیه: یکی از متری‌های خود آگهی را از گروه برمی‌داریم و میانه‌ی بقیه را می‌گیریم.
      const values = [...(groupValues.get(`${district}|${kind}`) ?? [])];
      const ownIndex = values.indexOf(perMeter);
      if (ownIndex >= 0) {
        values.splice(ownIndex, 1);
      }
      const othersMedian = median(values);
      if (othersMedian !== null) {
        belowAverage = perMeter < othersMedian * 0.9;
      }
    }
    return {
      ...listing,
      perMeter,
      districtAveragePerMeter: average ? average.averagePerMeter : null,
      districtAverageCount: average ? average.count : null,
      belowAverage,
    };
  });
}
