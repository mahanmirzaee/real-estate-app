// این فایل میز دوم بنگاه است: آگهی‌های خام را می‌گیرد، آگهی آژانس را کنار می‌گذارد
// و فقط فایل‌های شخصی را نگه می‌دارد. این فایل هیچ‌چیز از دیوار یا شیپور نمی‌داند؛
// فقط آگهی آماده را از میز اول تحویل می‌گیرد.

import { Injectable, Logger } from '@nestjs/common';
import { AGENCY_WORDS, BLACKLIST_PHRASES } from '../common/constants';
import { RAHN_TO_EJARE_RATIO } from '../convert/convert.service';
import { FetchService } from '../fetch/fetch.service';
import { Listing, RawPost } from '../fetch/listing.interface';
import { RedisService } from '../redis/redis.service';
import { ListingsRepository } from './listings.repository';
import { parsePrice } from './price-parser';

// یک آگهی به‌علاوه‌ی «معادل رهن کامل» آن؛ یعنی رهن + اجاره‌ای که با نسبت ۳٪ به رهن برگشته است.
export interface BudgetListing extends Listing {
  // معادل رهن کامل به تومان؛ مثلاً رهن ۱ میلیارد + اجاره‌ی ۳۰ میلیون می‌شود ۲ میلیارد.
  equivalentRahn: number;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly fetchService: FetchService,
    private readonly repository: ListingsRepository,
    private readonly redis: RedisService,
  ) {}

  // یک دور تازه از همه‌ی منبع‌ها می‌گیرد، فیلتر می‌کند و تازه‌ها را ذخیره می‌کند؛
  // بعد هم لیست‌های روی تخته‌ی ردیس را پاک می‌کند تا دفعه‌ی بعد تازه خوانده شوند.
  async refresh(): Promise<{ fetched: number; added: number; skippedAgency: number; total: number }> {
    const rawPosts = await this.fetchService.fetchAll();
    let skippedAgency = 0;
    const fresh: Listing[] = [];
    for (const post of rawPosts) {
      // اگر سایت خودش گفته باشد آگهی مال آژانس است، یا متن آگهی کلمه‌ی آژانس داشته باشد،
      // یا جمله‌ی ممنوعه‌ی ماهان را داشته باشد، کنارش می‌گذاریم.
      if (post.isAgency === true || !this.isPersonal(post) || this.isBlacklisted(post)) {
        skippedAgency++;
        continue;
      }
      // عدد رهن و اجاره را همان‌جا که آگهی تمیز می‌شود، از متن قیمت درمی‌آوریم؛
      // اگر قیمت خوانده نشد، هر دو خالی می‌مانند و آگهی از جست‌وجوی بودجه کنار می‌ماند.
      const parsed = parsePrice(post.priceText, post.category);
      fresh.push({
        token: post.token,
        title: post.title,
        priceText: post.priceText,
        district: post.district,
        category: post.category,
        categoryLabel: post.categoryLabel,
        url: post.url,
        isPersonal: true,
        source: post.source,
        fetchedAt: new Date().toISOString(),
        // عکس را هم با خودش می‌بریم؛ اگر عکس نبود، خالی می‌ماند.
        imageUrl: post.imageUrl ? post.imageUrl : null,
        rahnAmount: parsed.rahnAmount,
        ejareAmount: parsed.ejareAmount,
      });
    }
    const saved = await this.repository.upsert(fresh);
    // حافظه‌ی موقت را پاک می‌کنیم تا لیست بعدی از دیتابیس تازه خوانده شود.
    await this.redis.delByPrefix('listings:');
    return { fetched: rawPosts.length, added: saved.added, skippedAgency, total: saved.total };
  }

  // آگهی‌های ذخیره‌شده را برمی‌گرداند؛ اگر محله داده شود، فقط همان محله را می‌دهد.
  // جواب ۶۰ ثانیه روی تخته‌ی ردیس می‌ماند؛ اگر ردیس خواب بود، از دیتابیس می‌خوانیم.
  async findAll(district?: string): Promise<Listing[]> {
    const key = district ? `listings:district:${district}` : 'listings:all';
    const cached = await this.redis.get(key);
    if (cached) {
      this.logger.log(`لیست آگهی‌ها از حافظه‌ی ردیس آمد (کلید ${key}).`);
      return JSON.parse(cached) as Listing[];
    }
    const all = await this.repository.findAll();
    const result = district ? all.filter((listing) => listing.district.includes(district)) : all;
    await this.redis.set(key, JSON.stringify(result), 60);
    return result;
  }

  // یک آگهی را با شناسه‌اش برمی‌گرداند.
  async findOne(token: string): Promise<Listing | undefined> {
    return this.repository.findByToken(token);
  }

  // آگهی‌های شخصی که «معادل رهن کامل» آن‌ها زیر سقف است؛ نزدیک‌ترین به هدف اول.
  // معادل رهن کامل یعنی رهن + اجاره‌ای که با همان نسبت ۳٪ ماشین‌حساب به رهن برگشته است؛
  // پس هر ترکیبی که به هدف برسد پیدا می‌شود، نه فقط آگهی‌هایی که خود رهنشان برابر هدف است:
  // رهن ۱٫۵ میلیارد + اجاره‌ی ۱۵ میلیون، رهن ۵۰۰ میلیون + اجاره‌ی ۴۵ میلیون،
  // رهن ۲ میلیارد بدون اجاره، و حتی رهن صفر + اجاره‌ی ۶۰ میلیون — همه معادل ۲ میلیاردند.
  // فقط آگهی‌هایی می‌آیند که هر دو عددشان خوانده شده باشد؛ اگر رهن یا اجاره معلوم نباشد،
  // معادلش حدس زده نمی‌شود و آگهی کنار می‌ماند. هیچ‌چیز بالای سقف نمی‌آید.
  async findByBudget(target: number, max: number): Promise<BudgetListing[]> {
    const all = await this.repository.findAll();
    const results: BudgetListing[] = [];
    for (const listing of all) {
      if (listing.rahnAmount === null || listing.rahnAmount === undefined) {
        continue;
      }
      if (listing.ejareAmount === null || listing.ejareAmount === undefined) {
        continue;
      }
      // اجاره را با همان نسبت ۳٪ به رهن برمی‌گردانیم؛ عدد را گرد می‌کنیم تا خرده‌ی اعشاری نماند.
      const equivalentRahn = Math.round(
        listing.rahnAmount + listing.ejareAmount / RAHN_TO_EJARE_RATIO,
      );
      if (equivalentRahn <= 0 || equivalentRahn > max) {
        continue;
      }
      results.push({ ...listing, equivalentRahn });
    }
    // نزدیک‌ترین به هدف اول؛ یعنی آگهی‌ای که معادلش به هدف نزدیک‌تر است، بالاتر می‌آید.
    results.sort(
      (a, b) => Math.abs(a.equivalentRahn - target) - Math.abs(b.equivalentRahn - target),
    );
    return results;
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
