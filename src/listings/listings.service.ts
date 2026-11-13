// این فایل میز دوم بنگاه است: آگهی‌های خام را می‌گیرد، آگهی آژانس را کنار می‌گذارد
// و فقط فایل‌های شخصی را نگه می‌دارد. این فایل هیچ‌چیز از دیوار نمی‌داند؛
// فقط آگهی آماده را از میز اول تحویل می‌گیرد.

import { Injectable } from '@nestjs/common';
import { AGENCY_WORDS, BLACKLIST_PHRASES } from '../common/constants';
import { FetchService } from '../fetch/fetch.service';
import { Listing, RawPost } from '../fetch/listing.interface';
import { ListingsRepository } from './listings.repository';

@Injectable()
export class ListingsService {
  constructor(
    private readonly fetchService: FetchService,
    private readonly repository: ListingsRepository,
  ) {}

  // یک دور تازه از دیوار می‌گیرد، فیلتر می‌کند و تازه‌ها را ذخیره می‌کند.
  async refresh(): Promise<{ fetched: number; added: number; skippedAgency: number; total: number }> {
    const rawPosts = await this.fetchService.fetchAll();
    let skippedAgency = 0;
    const fresh: Listing[] = [];
    for (const post of rawPosts) {
      // اگر آگهی مال آژانس بود یا جمله‌ی ممنوعه داشت، کنارش می‌گذاریم.
      if (!this.isPersonal(post) || this.isBlacklisted(post)) {
        skippedAgency++;
        continue;
      }
      fresh.push({
        token: post.token,
        title: post.title,
        priceText: post.priceText,
        district: post.district,
        category: post.category,
        categoryLabel: post.categoryLabel,
        url: `https://divar.ir/v/${post.token}`,
        isPersonal: true,
        source: 'divar',
        fetchedAt: new Date().toISOString(),
      });
    }
    const saved = this.repository.upsert(fresh);
    return { fetched: rawPosts.length, added: saved.added, skippedAgency, total: saved.total };
  }

  // آگهی‌های ذخیره‌شده را برمی‌گرداند؛ اگر محله داده شود، فقط همان محله را می‌دهد.
  findAll(district?: string): Listing[] {
    const all = this.repository.findAll();
    if (!district) {
      return all;
    }
    return all.filter((listing) => listing.district.includes(district));
  }

  // یک آگهی را با شناسه‌اش برمی‌گرداند.
  findOne(token: string): Listing | undefined {
    return this.repository.findByToken(token);
  }

  // آگهی شخصی یعنی: در توضیحش اسم محله آمده باشد («در مهران») و کلمه‌ی آژانس نداشته باشد.
  // آگهی‌های شخصی معمولاً فقط می‌نویسند «در فلان محله» و تمام.
  private isPersonal(post: RawPost): boolean {
    const bottom = post.bottomText || '';
    const mentionsDistrict = bottom.includes(' در ') || bottom.startsWith('در ');
    if (!mentionsDistrict) {
      return false;
    }
    return !AGENCY_WORDS.some((word) => bottom.includes(word));
  }

  // اگر تیتر یا توضیح آگهی یکی از جمله‌های ممنوعه‌ی ماهان را داشته باشد، آگهی رد می‌شود.
  private isBlacklisted(post: RawPost): boolean {
    return BLACKLIST_PHRASES.some(
      (phrase) => post.title.includes(phrase) || post.bottomText.includes(phrase),
    );
  }
}
