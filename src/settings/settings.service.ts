// این فایل دفترچه‌ی تنظیمات برنامه است؛ محله‌ها اینجا زندگی می‌کنند.
// محله‌ها در دیتابیس‌اند، نه در کد؛ پس ماهان از روی صفحه اضافه و حذفشان می‌کند
// و لازم نیست برای هر محله‌ی تازه، کد عوض شود.
// اگر هنوز تنظیمی ذخیره نشده باشد، همان سه محله‌ی دفترچه‌ی ثابت برمی‌گردد.

import { Injectable, Logger } from '@nestjs/common';
import { DISTRICTS, SHEYPOOR_DISTRICT_MAP, SHEYPOOR_NEIGHBOURHOOD_IDS } from '../common/constants';
import { PrismaService } from '../prisma/prisma.service';
import { DistrictConfig } from './district-config';

// کلید محله‌ها در جدول تنظیمات.
const DISTRICTS_KEY = 'districts';

// سه محله‌ی پیش‌فرض ماهان، با شناسه‌های هر دو سایت؛
// شناسه‌های شیپور را زنده از سایت شیپور گرفته‌ایم.
// «سید خندان» همان جلفاست؛ شیپور برای جلفا محله‌ی جداگانه‌ای ندارد.
const DEFAULT_DISTRICTS: DistrictConfig[] = [
  { id: '95', name: 'مهران', sheypoorId: '4757', sheypoorName: 'مهران - منطقه 4' },
  { id: '1028', name: 'جلفا', sheypoorId: '4711', sheypoorName: 'سید خندان' },
  { id: '127', name: 'دبستان', sheypoorId: '1046', sheypoorName: 'دبستان' },
];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // محله‌های پیکربندی‌شده را می‌دهد؛ اگر هنوز چیزی ذخیره نشده باشد، پیش‌فرض‌ها برمی‌گردند.
  // اگر مقدار ذخیره‌شده خراب باشد، پیش‌فرض‌ها برمی‌گردند و خطا نوشته می‌شود؛
  // برنامه به‌خاطر یک تنظیم خراب نمی‌ایستد.
  async getDistricts(): Promise<{ districts: DistrictConfig[]; isDefault: boolean }> {
    try {
      const row = await this.prisma.appConfig.findUnique({ where: { key: DISTRICTS_KEY } });
      if (!row) {
        return { districts: DEFAULT_DISTRICTS, isDefault: true };
      }
      const parsed: unknown = JSON.parse(row.value);
      const districts = cleanDistricts(parsed);
      if (districts === null) {
        this.logger.warn('تنظیم محله‌ها خراب است؛ پیش‌فرض‌ها برگشتند.');
        return { districts: DEFAULT_DISTRICTS, isDefault: true };
      }
      return { districts, isDefault: false };
    } catch (error) {
      this.logger.warn(
        `خواندن تنظیم محله‌ها نشد: ${error instanceof Error ? error.message : String(error)}؛ پیش‌فرض‌ها برگشتند.`,
      );
      return { districts: DEFAULT_DISTRICTS, isDefault: true };
    }
  }

  // فهرست محله‌ها را کامل عوض می‌کند؛ یعنی اضافه و حذف، هر دو از همین راه‌اند.
  // حداقل یک محله باید بماند؛ شناسه‌ها باید عدد باشند و تکراری نباشند.
  async setDistricts(districts: unknown): Promise<DistrictConfig[]> {
    const clean = cleanDistricts(districts);
    if (clean === null || clean.length === 0) {
      throw new Error('فهرست محله‌ها درست نیست؛ حداقل یک محله با شناسه‌ی عددی لازم است');
    }
    await this.prisma.appConfig.upsert({
      where: { key: DISTRICTS_KEY },
      create: { key: DISTRICTS_KEY, value: JSON.stringify(clean) },
      update: { value: JSON.stringify(clean) },
    });
    return clean;
  }

  // یک محله تازه اضافه می‌کند؛ اسم لازم است، شناسه‌ی عددی اختیاری است.
  // اگر شناسه داده شود، همان استفاده می‌شود؛ اگر نه، اسم در نقشه‌ی شناخته‌شده
  // جست‌وجو می‌شود (فعلاً فقط مهران، جلفا و دبستان)؛ اگر اسم هم شناخته‌شده نبود،
  // خطا می‌دهد و ماهان باید شناسه را خودش از آدرس صفحه‌ی جست‌وجوی دیوار بردارد.
  // محله‌ی تکراری (همان شناسه یا همان اسم) اضافه نمی‌شود.
  // برمی‌گرداند فهرست تازه و شناسه‌ای که برای محله استفاده شد.
  async addDistrict(
    name: string,
    id?: string | number | null,
  ): Promise<{ districts: DistrictConfig[]; resolvedId: string }> {
    const cleanName = String(name ?? '').trim();
    if (cleanName.length === 0) {
      throw new Error('اسم محله لازم است');
    }
    const { districts } = await this.getDistricts();
    if (districts.some((district) => district.name === cleanName)) {
      throw new Error(`محله‌ی ${cleanName} قبلاً اضافه شده است`);
    }
    let resolvedId = '';
    let known: DistrictConfig | undefined;
    if (id !== null && id !== undefined && String(id).trim() !== '') {
      resolvedId = String(id).trim();
      if (!/^\d+$/.test(resolvedId)) {
        throw new Error('شناسه‌ی محله باید عدد باشد');
      }
    } else {
      known = DEFAULT_DISTRICTS.find((district) => district.name === cleanName);
      if (!known) {
        // اسم در نقشه‌ی شناخته‌شده نیست؛ دیوار برای محله‌ها `API` (ای‌پی‌آی)
        // نام‌به‌شناسه ندارد و صفحه‌ی جست‌وجویش هم داده‌ی محله نمی‌دهد،
        // پس شناسه را باید ماهان از آدرس صفحه‌ی جست‌وجو بردارد.
        throw new Error(
          `شناسه‌ی عددی محله‌ی ${cleanName} را نمی‌دانم؛ شناسه را از آدرس صفحه‌ی جست‌وجوی آن محله در سایت دیوار بردار (در آدرس، بعد از districts= عدد محله است) و در همان فرم وارد کن`,
        );
      }
      resolvedId = known.id;
    }
    if (districts.some((district) => district.id === resolvedId)) {
      throw new Error(`محله‌ای با شناسه‌ی ${resolvedId} قبلاً اضافه شده است`);
    }
    const next: DistrictConfig = known
      ? { ...known, name: cleanName }
      : { id: resolvedId, name: cleanName };
    const saved = await this.setDistricts([...districts, next]);
    return { districts: saved, resolvedId };
  }

  // یک محله را با شناسه‌اش حذف می‌کند؛ آخرین محله حذف نمی‌شود.
  async removeDistrict(id: string): Promise<DistrictConfig[]> {
    const { districts } = await this.getDistricts();
    const kept = districts.filter((district) => district.id !== String(id));
    if (kept.length === districts.length) {
      throw new Error(`محله‌ای با شناسه‌ی ${id} نیست`);
    }
    if (kept.length === 0) {
      throw new Error('آخرین محله را نمی‌شود حذف کرد؛ حداقل یک محله باید بماند');
    }
    return this.setDistricts(kept);
  }

  // شناسه‌های شیپور برای محله‌های پیکربندی‌شده؛
  // اگر تنظیمی نبود، همان فهرست ثابت قبلی برمی‌گردد.
  async getSheypoorNeighbourhoodIds(): Promise<string[]> {
    const { districts, isDefault } = await this.getDistricts();
    if (isDefault) {
      return SHEYPOOR_NEIGHBOURHOOD_IDS;
    }
    const ids = districts
      .map((district) => district.sheypoorId)
      .filter((id): id is string => !!id);
    return ids.length > 0 ? ids : SHEYPOOR_NEIGHBOURHOOD_IDS;
  }

  // اسم شیپور به اسم نمایشی؛ اول نقشه‌ی ثابت قبلی، بعد محله‌های پیکربندی‌شده روی آن.
  // برای سه محله‌ی پیش‌فرض، اسم نمایشی همان قبلی است («سید خندان (جلفا)») تا
  // آگهی‌های قدیمی و تازه یک محله، یک اسم داشته باشند و میانگین محله دو تکه نشود.
  async getSheypoorDistrictMap(): Promise<Record<string, string>> {
    const { districts, isDefault } = await this.getDistricts();
    const map: Record<string, string> = { ...SHEYPOOR_DISTRICT_MAP };
    if (!isDefault) {
      for (const district of districts) {
        if (district.sheypoorName) {
          map[district.sheypoorName] = SHEYPOOR_DISTRICT_MAP[district.sheypoorName] ?? district.name;
        }
      }
    }
    return map;
  }
}

// یک مقدار خام را تمیز می‌کند و اگر شکل محله‌ها را داشت، برمی‌گرداند؛
// اگر نداشت، خالی برمی‌گرداند. شناسه باید عدد باشد و اسم نباید خالی باشد.
// محله‌ی تکراری (با همان شناسه) فقط یک بار می‌ماند.
function cleanDistricts(value: unknown): DistrictConfig[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const out: DistrictConfig[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }
    const raw = item as Record<string, unknown>;
    const id = String(raw.id ?? '').trim();
    const name = String(raw.name ?? '').trim();
    if (!/^\d+$/.test(id) || name.length === 0 || seen.has(id)) {
      return null;
    }
    seen.add(id);
    const sheypoorId =
      typeof raw.sheypoorId === 'string' && /^\d+$/.test(raw.sheypoorId.trim())
        ? raw.sheypoorId.trim()
        : undefined;
    const sheypoorName =
      typeof raw.sheypoorName === 'string' && raw.sheypoorName.trim().length > 0
        ? raw.sheypoorName.trim()
        : undefined;
    out.push({ id, name, sheypoorId, sheypoorName });
  }
  return out;
}
