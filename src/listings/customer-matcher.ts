// این فایل «مشتری‌یاب» است؛ جمله‌ی فارسی ماهان را می‌خواند و می‌فهمد مشتری چه می‌خواهد.
// هیچ سرویس هوش مصنوعی بیرونی اینجا نیست؛ فقط قانون و کلمه است —
// مثل اینکه جمله را با خط‌کش بخوانی: «اجاره» یعنی اجاره، «۵۰۰ ودیعه» یعنی ۵۰۰ میلیون ودیعه،
// «پارکینگ می‌خواد» یعنی پارکینگ لازم است. اگر جمله چیزی نداشت که فهمیده شود،
// همان را می‌گوید و مثال می‌زند؛ حدس نمی‌زند.

import { RAHN_TO_EJARE_RATIO } from '../convert/convert.service';
import { Listing } from '../fetch/listing.interface';
import { DistrictConfig } from '../settings/district-config';
import { normalizePersianDigits } from './price-parser';
import { equivalentRahnOf, normalizeDistrictName } from './per-meter';

// خواسته‌ی یک مشتری؛ چه از جمله درآمده باشد، چه از دفترچه‌ی مشتری‌ها.
// سقف‌ها همه «حداکثر» اند؛ یعنی آگهی باید زیر این سقف بماند.
export interface MatchCriteria {
  // دنبال اجاره است یا خرید؛ اگر معلوم نباشد، خالی است و هر دو نوع می‌آید.
  kind: 'rent' | 'buy' | null;
  // سقف ودیعه برای اجاره، سقف قیمت کل برای خرید؛ اگر خالی باشد یعنی سقفی ندارد.
  maxDeposit: number | null;
  // سقف اجاره‌ی ماهانه؛ فقط برای اجاره معنی دارد.
  maxRent: number | null;
  // محله‌ای که می‌خواهد؛ اگر خالی باشد یعنی هر محله‌ای.
  district: string | null;
  // نوع ملک؛ اگر خالی باشد یعنی هر نوعی.
  propertyKind: 'apartment' | 'office' | 'land' | null;
  // این امکانات را می‌خواهد؟ درست یعنی «می‌خواهد»، غلط یعنی «فرقی نمی‌کند».
  wantsParking: boolean;
  wantsStorage: boolean;
  wantsElevator: boolean;
}

// چیزی که از جمله فهمیده شد؛ همان خواسته است، به‌علاوه‌ی دو عدد معادل و یک خط خلاصه.
export interface ParsedCustomer extends MatchCriteria {
  // سقف معادل رهن کامل؛ برای اجاره از ودیعه و اجاره ساخته می‌شود.
  // مثلاً ۵۰۰ میلیون ودیعه + ۷۰ میلیون اجاره می‌شود ۲٬۸۳۳٬۳۳۳٬۳۳۳.
  maxEquivalent: number | null;
  // هدفی که نتیجه‌ها به آن نزدیک می‌شوند؛ همان سقف معادل است.
  targetEquivalent: number | null;
  // آیا جمله چیزی داشت که فهمیده شود؟ اگر نه، نتیجه خالی است و پیام کمک می‌آید.
  understood: boolean;
  // یک خط خلاصه؛ مثل «اجاره، پارکینگ‌دار، تا معادل ۲٬۸۳۳٬۳۳۳٬۳۳۳ تومان رهن کامل».
  summary: string;
}

// نتیجه‌ی تطبیق؛ همان آگهی است، به‌علاوه‌ی عددی که با آن مرتب شده است:
// برای اجاره معادل رهن کامل، برای خرید قیمت فروش.
export type MatchedListing = Listing & {
  // معادل رهن کامل برای اجاره، قیمت فروش برای خرید؛ عدد مرتب‌سازی.
  matchValue: number | null;
  // معادل رهن کامل؛ فقط برای اجاره پر می‌شود تا روی کارت نشان داده شود.
  equivalentRahn?: number;
};

// متن را تمیز می‌کند: ارقام فارسی به لاتین، ی و ک عربی به فارسی،
// نیم‌فاصله برداشته می‌شود تا «می‌خواد» و «میخواد» یکی شوند.
function norm(text: string): string {
  return normalizePersianDigits(text)
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[\u200C\u200D]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// یک عدد با واحدش را به تومان برمی‌گرداند؛
// «میلیارد» یعنی ×۱٬۰۰۰٬۰۰۰٬۰۰۰، «میلیون» یعنی ×۱٬۰۰۰٬۰۰۰، «هزار» یعنی ×۱٬۰۰۰.
// اگر واحدی نبود، عدد میلیون تومان حساب می‌شود؛ چون در جمله‌ی مشتری
// «۵۰۰ ودیعه» یعنی ۵۰۰ میلیون تومان، نه ۵۰۰ تومان.
function amountToToman(value: number, unit?: string): number {
  if (unit === 'میلیارد') {
    return Math.round(value * 1_000_000_000);
  }
  if (unit === 'هزار') {
    return Math.round(value * 1_000);
  }
  return Math.round(value * 1_000_000);
}

// همه‌ی «عدد + واحد» های جمله را با جایشان پیدا می‌کند؛
 // هر عدد یک «دهانه» دارد تا دوبار خرج نشود.
function findAmounts(
  text: string,
): Array<{ value: number; unit?: string; start: number; end: number }> {
  const out: Array<{ value: number; unit?: string; start: number; end: number }> = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)?/g;
  for (const match of text.matchAll(pattern)) {
    const value = parseFloat(match[1]);
    if (!Number.isFinite(value)) {
      continue;
    }
    out.push({
      value,
      unit: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return out;
}

// عددی را پیدا می‌کند که نزدیک یک برچسب باشد؛ مثلاً بعد از «ودیعه» یا قبل از «اجاره».
// «نزدیک» یعنی حداکثر ۱۴ حرف فاصله؛ عددی که خیلی دور است، مال آن برچسب نیست.
// عددهایی که قبلاً خرج شده‌اند، دوباره استفاده نمی‌شوند.
function amountNearLabel(
  text: string,
  amounts: Array<{ value: number; unit?: string; start: number; end: number }>,
  used: Set<number>,
  labels: string[],
): number | null {
  // اول «برچسب بعد عدد»؛ مثل «۵۰۰ ودیعه» یا «۷۰ میلیون اجاره».
  for (const label of labels) {
    const labelPattern = new RegExp(label, 'g');
    for (const labelMatch of text.matchAll(labelPattern)) {
      const labelStart = labelMatch.index;
      const before = amounts.find(
        (item) =>
          !used.has(item.start) && item.end <= labelStart && labelStart - item.end <= 14,
      );
      if (before) {
        used.add(before.start);
        return amountToToman(before.value, before.unit);
      }
    }
  }
  // بعد «عدد بعد برچسب»؛ مثل «ودیعه ۵۰۰ میلیون» یا «اجاره ۷۰ میلیون».
  for (const label of labels) {
    const labelPattern = new RegExp(label, 'g');
    for (const labelMatch of text.matchAll(labelPattern)) {
      const labelEnd = labelMatch.index + labelMatch[0].length;
      const after = amounts.find(
        (item) =>
          !used.has(item.start) && item.start >= labelEnd && item.start - labelEnd <= 14,
      );
      if (after) {
        used.add(after.start);
        return amountToToman(after.value, after.unit);
      }
    }
  }
  return null;
}

// آیا جمله می‌گوید این امکان را «نمی‌خواهد»؟ مثل «بدون پارکینگ» یا «پارکینگ نمی‌خواد».
function isNegated(text: string, word: string): boolean {
  return (
    new RegExp(`بدون ${word}`).test(text) ||
    new RegExp(`${word} (نمی‌خواد|نمی‌خواهد|نخواد|نمی‌خوام|لازم نیست)`).test(text) ||
    new RegExp(`(نمی‌خواد|نمی‌خواهد) ${word}`).test(text)
  );
}

// آیا جمله می‌گوید این امکان را «می‌خواهد»؟ مثل «پارکینگ می‌خواد» یا «پارکینگ داشته باشه».
function isWanted(text: string, word: string): boolean {
  if (isNegated(text, word)) {
    return false;
  }
  return (
    new RegExp(
      `${word} (می‌خواد|می‌خواهد|میخواد|داشته باشه|دار|باشه|لازم|می‌خوام)`,
    ).test(text) || new RegExp(`(می‌خواد|می‌خواهد) ${word}`).test(text)
  );
}

// جمله‌ی مشتری را می‌خواند و خواسته‌اش را درمی‌آورد.
// محله‌ها از فهرست پیکربندی‌شده می‌آیند؛ «جلفا» با «سید خندان» هم یکی است.
export function parseCustomerSentence(
  sentence: string,
  districts: DistrictConfig[],
): ParsedCustomer {
  const text = norm(sentence ?? '');
  const empty: ParsedCustomer = {
    kind: null,
    maxDeposit: null,
    maxRent: null,
    district: null,
    propertyKind: null,
    wantsParking: false,
    wantsStorage: false,
    wantsElevator: false,
    maxEquivalent: null,
    targetEquivalent: null,
    understood: false,
    summary: '',
  };
  if (text.length === 0) {
    return empty;
  }

  // نوع: «خرید» یا «بخر» یعنی خرید؛ وگرنه «اجاره» یا «رهن» یعنی اجاره.
  let kind: 'rent' | 'buy' | null = null;
  if (/خرید|فروش|بخر/.test(text)) {
    kind = 'buy';
  } else if (/اجاره|رهن/.test(text)) {
    kind = 'rent';
  }

  // عددها؛ اول ودیعه، بعد اجاره — تا عدد ودیعه اشتباهی به اجاره نرود.
  const amounts = findAmounts(text);
  const used = new Set<number>();
  const maxDeposit = amountNearLabel(text, amounts, used, ['ودیعه', 'رهن', 'پیش', 'پول']);
  const maxRent = amountNearLabel(text, amounts, used, ['اجاره', 'ماهی', 'ماهانه']);

  // امکانات؛ «بدون» یعنی نمی‌خواهد، نه اینکه آگهی نباید داشته باشد.
  const wantsParking = isWanted(text, 'پارکینگ');
  const wantsStorage = isWanted(text, 'انباری');
  const wantsElevator = isWanted(text, 'آسانسور');

  // محله؛ از فهرست پیکربندی‌شده؛ «سید خندان» همان جلفاست.
  let district: string | null = null;
  for (const item of districts) {
    const name = normalizeDistrictName(item.name);
    if (name.length > 0 && text.includes(name)) {
      district = item.name;
      break;
    }
    if (item.name === 'جلفا' && /سید ?خندان/.test(text)) {
      district = item.name;
      break;
    }
  }

  // نوع ملک.
  let propertyKind: 'apartment' | 'office' | 'land' | null = null;
  if (/زمین|کلنگی/.test(text)) {
    propertyKind = 'land';
  } else if (/دفتر|اداری|دفترکار/.test(text)) {
    propertyKind = 'office';
  } else if (/آپارتمان|مسکونی|واحد/.test(text)) {
    propertyKind = 'apartment';
  }

  // سقف معادل رهن کامل؛ فقط برای اجاره.
  let maxEquivalent: number | null = null;
  let targetEquivalent: number | null = null;
  if (kind !== 'buy') {
    if (maxDeposit !== null && maxRent !== null) {
      maxEquivalent = Math.round(maxDeposit + maxRent / RAHN_TO_EJARE_RATIO);
    } else if (maxDeposit !== null) {
      maxEquivalent = maxDeposit;
    } else if (maxRent !== null) {
      maxEquivalent = Math.round(maxRent / RAHN_TO_EJARE_RATIO);
    }
    targetEquivalent = maxEquivalent;
  }

  const understood =
    kind !== null ||
    maxDeposit !== null ||
    maxRent !== null ||
    district !== null ||
    propertyKind !== null ||
    wantsParking ||
    wantsStorage ||
    wantsElevator;

  // یک خط خلاصه؛ همان چیزی که فهمیده‌ایم، به زبان آدم.
  const parts: string[] = [];
  if (kind === 'rent') {
    parts.push('اجاره');
  } else if (kind === 'buy') {
    parts.push('خرید');
  }
  if (propertyKind === 'apartment') {
    parts.push('مسکونی');
  } else if (propertyKind === 'office') {
    parts.push('دفترکار');
  } else if (propertyKind === 'land') {
    parts.push('زمین');
  }
  if (district) {
    parts.push(`در ${district}`);
  }
  if (wantsParking) {
    parts.push('پارکینگ‌دار');
  }
  if (wantsStorage) {
    parts.push('انباری‌دار');
  }
  if (wantsElevator) {
    parts.push('آسانسوردار');
  }
  if (kind === 'buy' && maxDeposit !== null) {
    parts.push(`تا ${faNum(maxDeposit)} تومان`);
  } else if (maxEquivalent !== null) {
    parts.push(`تا معادل ${faNum(maxEquivalent)} تومان رهن کامل`);
  }
  const summary = parts.join('، ');

  return {
    kind,
    maxDeposit,
    maxRent,
    district,
    propertyKind,
    wantsParking,
    wantsStorage,
    wantsElevator,
    maxEquivalent,
    targetEquivalent,
    understood,
    summary,
  };
}

// عدد را سه‌رقم سه‌رقم با ارقام فارسی می‌نویسد؛ مثل ۲٬۸۳۳٬۳۳۳٬۳۳۳.
function faNum(value: number): string {
  return Math.round(value).toLocaleString('fa-IR');
}

// آگهی‌ها را با خواسته‌ی مشتری جور می‌کند؛ همان منطق بودجه، به‌علاوه‌ی امکانات و محله.
// برای اجاره: معادل رهن کامل باید زیر سقف باشد؛ برای خرید: قیمت فروش زیر سقف.
// امکانات خواسته‌شده باید واقعاً «دارد» باشند؛ آگهی‌ای که امکانش «معلوم نیست»، نمی‌آید.
// مرتب‌سازی: نزدیک‌ترین به خواسته‌ی مشتری اول؛ آگهی‌هایی که قیمتشان معلوم نیست، آخر می‌آیند.
export function matchListings(listings: Listing[], criteria: MatchCriteria): MatchedListing[] {
  // سقف معادل رهن کامل؛ برای خرید خالی است، چون آنجا سقف همان قیمت فروش است.
  const maxEquivalent = maxEquivalentOf(criteria);
  const out: MatchedListing[] = [];
  for (const listing of listings) {
    // نوع: اجاره یا خرید.
    if (criteria.kind === 'rent' && !listing.category.endsWith('-rent')) {
      continue;
    }
    if (criteria.kind === 'buy' && listing.category.endsWith('-rent')) {
      continue;
    }
    // نوع ملک.
    if (criteria.propertyKind === 'apartment' && !listing.category.startsWith('apartment')) {
      continue;
    }
    if (criteria.propertyKind === 'office' && !listing.category.startsWith('office')) {
      continue;
    }
    if (criteria.propertyKind === 'land' && listing.category !== 'plot-old') {
      continue;
    }
    // محله؛ اسم محله‌ی آگهی باید همان محله‌ی خواسته‌شده باشد.
    if (criteria.district) {
      const listingDistrict = normalizeDistrictName(listing.district);
      const wanted = normalizeDistrictName(criteria.district);
      const aliasHit =
        criteria.district === 'جلفا' && /سیدخندان/.test(listingDistrict);
      if (!aliasHit && !listingDistrict.includes(wanted) && !wanted.includes(listingDistrict)) {
        continue;
      }
    }
    // امکانات؛ فقط «دارد» قبول است، «معلوم نیست» نه.
    if (criteria.wantsParking && listing.features?.parking !== true) {
      continue;
    }
    if (criteria.wantsStorage && listing.features?.storage !== true) {
      continue;
    }
    if (criteria.wantsElevator && listing.features?.elevator !== true) {
      continue;
    }
    // قیمت.
    if (criteria.kind === 'buy') {
      const price = listing.saleAmount ?? null;
      if (criteria.maxDeposit !== null) {
        if (price === null || price <= 0 || price > criteria.maxDeposit) {
          continue;
        }
      }
      out.push({ ...listing, matchValue: price });
      continue;
    }
    const equivalent = equivalentRahnOf(listing);
    if (maxEquivalent !== null) {
      if (equivalent === null || equivalent <= 0 || equivalent > maxEquivalent) {
        continue;
      }
    }
    out.push({ ...listing, matchValue: equivalent, equivalentRahn: equivalent ?? undefined });
  }
  // نزدیک‌ترین به هدف اول؛ آگهی‌های بی‌قیمت آخر، تازه‌ترین اول.
  const target = criteria.kind === 'buy' ? criteria.maxDeposit : maxEquivalent;
  out.sort((a, b) => {
    if (a.matchValue === null && b.matchValue === null) {
      return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime();
    }
    if (a.matchValue === null) {
      return 1;
    }
    if (b.matchValue === null) {
      return -1;
    }
    if (target !== null) {
      return Math.abs(a.matchValue - target) - Math.abs(b.matchValue - target);
    }
    return new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime();
  });
  return out;
}

// سقف معادل رهن کامل را از سقف ودیعه و سقف اجاره می‌سازد؛ همان فرمول بودجه.
export function maxEquivalentOf(criteria: MatchCriteria): number | null {
  if (criteria.kind === 'buy') {
    return null;
  }
  if (criteria.maxDeposit !== null && criteria.maxRent !== null) {
    return Math.round(criteria.maxDeposit + criteria.maxRent / RAHN_TO_EJARE_RATIO);
  }
  if (criteria.maxDeposit !== null) {
    return criteria.maxDeposit;
  }
  if (criteria.maxRent !== null) {
    return Math.round(criteria.maxRent / RAHN_TO_EJARE_RATIO);
  }
  return null;
}
