// این فایل میز اول بنگاه است: از همه‌ی منبع‌های روشن آگهی خام جمع می‌کند.
// مثل سرپرست پیک‌ها که به هر پیک می‌گوید برو و برگرد، بعد همه‌ی فایل‌ها را یک جا تحویل می‌دهد.
// اگر یک منبع جواب نداد، بقیه‌ی منبع‌ها باز هم کارشان را می‌کنند و فقط خطا نوشته می‌شود.

import { Injectable, Logger } from '@nestjs/common';
import { DISTRICT_IDS, SHEYPOOR_DISTRICT_MAP, SHEYPOOR_NEIGHBOURHOOD_IDS } from '../common/constants';
import { SettingsService } from '../settings/settings.service';
import { RawPost } from './listing.interface';
import { FetchScope } from './listing-source.interface';
import { ListingSourceFactory } from './source-factory';

@Injectable()
export class FetchService {
  private readonly logger = new Logger(FetchService.name);

  constructor(
    private readonly factory: ListingSourceFactory,
    private readonly settings: SettingsService,
  ) {}

  // محدوده‌ی جست‌وجو را از تنظیمات می‌خواند؛ اگر تنظیمی نبود، همان سه محله‌ی ثابت.
  // اگر خواندن تنظیمات نشد، باز هم با همان سه محله ادامه می‌دهیم؛
  // تازه‌سازی به‌خاطر تنظیمات نمی‌ایستد.
  private async getScope(): Promise<FetchScope> {
    const fallback: FetchScope = {
      divarDistrictIds: DISTRICT_IDS,
      sheypoorNeighbourhoodIds: SHEYPOOR_NEIGHBOURHOOD_IDS,
      sheypoorDistrictMap: SHEYPOOR_DISTRICT_MAP,
    };
    try {
      const { districts } = await this.settings.getDistricts();
      const neighbourhoodIds = await this.settings.getSheypoorNeighbourhoodIds();
      const districtMap = await this.settings.getSheypoorDistrictMap();
      return {
        divarDistrictIds: districts.map((district) => district.id),
        sheypoorNeighbourhoodIds: neighbourhoodIds,
        sheypoorDistrictMap: districtMap,
      };
    } catch (error) {
      this.logger.warn(
        `خواندن محله‌ها از تنظیمات نشد: ${error instanceof Error ? error.message : String(error)}؛ با محله‌های ثابت ادامه می‌دهیم.`,
      );
      return fallback;
    }
  }

  // از همه‌ی منبع‌ها می‌گیرد؛ هر منبع حداکثر دو صفحه، تا کار خیلی طول نکشد.
  async fetchAll(maxPages = 2): Promise<RawPost[]> {
    const all: RawPost[] = [];
    const scope = await this.getScope();
    for (const source of this.factory.getSources()) {
      try {
        const posts = await source.fetchAll(maxPages, scope);
        // تعداد هر منبع را جدا می‌نویسیم تا معلوم باشد از کجا چند تا آمده است.
        this.logger.log(`از ${source.source} ${posts.length} آگهی خام گرفتیم.`);
        all.push(...posts);
      } catch (error) {
        this.logger.error(
          `گرفتن آگهی از ${source.source} نشد: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return all;
  }
}
