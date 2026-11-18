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
  districtAveragePerMeter: number | null;
  // آیا متری این آگهی بیش از ۱۰٪ زیر میانگین محله‌اش است؟ یعنی «زیر قیمت».
  belowAverage: boolean;
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
  // میانگین متری به تومان.
  averagePerMeter: number;
  // چند آگهی در این میانگین شمرده شده است.
  count: number;
}

// میانگین متری هر محله و هر نوع را از لیست آگهی‌ها حساب می‌کند.
// فقط آگهی‌هایی که متری دارند شمرده می‌شوند.
export function districtAverages(
  listings: Listing[],
  districts: DistrictConfig[],
): DistrictAverage[] {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const listing of listings) {
    const perMeter = perMeterOf(listing);
    if (perMeter === null) {
      continue;
    }
    const key = `${resolveDistrictName(listing.district, districts)}|${kindGroupOf(listing)}`;
    const group = groups.get(key) ?? { sum: 0, count: 0 };
    group.sum += perMeter;
    group.count++;
    groups.set(key, group);
  }
  const out: DistrictAverage[] = [];
  for (const [key, group] of groups) {
    const [district, kind] = key.split('|');
    out.push({
      district,
      kind: kind as 'rent' | 'buy',
      averagePerMeter: Math.round(group.sum / group.count),
      count: group.count,
    });
  }
  return out;
}

// روی هر آگهی سه فیلد متری می‌گذارد: متری خودش، میانگین متری محله‌اش، و «زیر قیمت» بودن.
// «زیر قیمت» یعنی متری آگهی بیش از ۱۰٪ زیر میانگین بقیه‌ی آگهی‌های همان محله و همان نوع است؛
// میانگین بقیه حساب می‌شود، نه میانگین با خودش، تا آگهی تنها در محله «زیر قیمت» نشود.
export function enrichListings(
  listings: Listing[],
  districts: DistrictConfig[],
): ListingWithPerMeter[] {
  const averages = districtAverages(listings, districts);
  const byKey = new Map(averages.map((item) => [`${item.district}|${item.kind}`, item]));
  return listings.map((listing) => {
    const perMeter = perMeterOf(listing);
    const district = resolveDistrictName(listing.district, districts);
    const kind = kindGroupOf(listing);
    const average = byKey.get(`${district}|${kind}`) ?? null;
    let belowAverage = false;
    if (perMeter !== null && average !== null && average.count >= 2) {
      // میانگین بقیه: مجموع منهای خود آگهی، تقسیم بر بقیه.
      const othersAverage = Math.round(
        (average.averagePerMeter * average.count - perMeter) / (average.count - 1),
      );
      belowAverage = perMeter < othersAverage * 0.9;
    }
    return {
      ...listing,
      perMeter,
      districtAveragePerMeter: average ? average.averagePerMeter : null,
      belowAverage,
    };
  });
}
