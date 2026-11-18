// این فایل میز دوم بنگاه است: آگهی‌های خام را می‌گیرد، آگهی آژانس را کنار می‌گذارد
// و فقط فایل‌های شخصی را نگه می‌دارد. این فایل هیچ‌چیز از دیوار یا شیپور نمی‌داند؛
// فقط آگهی آماده را از میز اول تحویل می‌گیرد.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Client } from '@prisma/client';
import { AGENCY_WORDS, BLACKLIST_PHRASES, DISTRICTS } from '../common/constants';
import { RAHN_TO_EJARE_RATIO } from '../convert/convert.service';
import { FetchService } from '../fetch/fetch.service';
import { Listing, RawPost } from '../fetch/listing.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ClientMatch, RefreshResult } from '../scheduler/refresh-status.service';
import { DistrictConfig } from '../settings/district-config';
import { SettingsService } from '../settings/settings.service';
import { extractArea } from './area';
import {
  MatchCriteria,
  ParsedCustomer,
  matchListings,
  maxEquivalentOf,
  parseCustomerSentence,
} from './customer-matcher';
import { extractFeatures } from './features';
import { ListingsRepository } from './listings.repository';
import { ListingWithPerMeter, enrichListings, equivalentRahnOf } from './per-meter';
import { parsePrice } from './price-parser';

// یک آگهی به‌علاوه‌ی «معادل رهن کامل» آن؛ یعنی رهن + اجاره‌ای که با نسبت ۳٪ به رهن برگشته است.
export interface BudgetListing extends Listing {
  // معادل رهن کامل به تومان؛ مثلاً رهن ۱ میلیارد + اجاره‌ی ۳۰ میلیون می‌شود ۲ میلیارد.
  equivalentRahn: number;
}

// وضعیت‌هایی که ماهان می‌تواند روی یک آگهی بگذارد.
// 'called' یعنی زنگ زدم، 'visited' یعنی بازدید رفت، 'done' یعنی معامله شد، 'rejected' یعنی رد شد.
export const LISTING_STATUSES = ['called', 'visited', 'done', 'rejected'] as const;
export type ListingStatusValue = (typeof LISTING_STATUSES)[number];

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly fetchService: FetchService,
    private readonly repository: ListingsRepository,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // محله‌های پیکربندی‌شده؛ اگر خواندن تنظیمات نشد، همان سه محله‌ی دفترچه‌ی ثابت.
  private async getDistricts(): Promise<DistrictConfig[]> {
    try {
      const { districts } = await this.settings.getDistricts();
      return districts;
    } catch (error) {
      this.logger.warn(
        `خواندن محله‌ها از تنظیمات نشد: ${error instanceof Error ? error.message : String(error)}؛ با محله‌های ثابت ادامه می‌دهیم.`,
      );
      return DISTRICTS.map((district) => ({ id: district.id, name: district.name }));
    }
  }

  // یک دور تازه از همه‌ی منبع‌ها می‌گیرد، فیلتر می‌کند و تازه‌ها را ذخیره می‌کند؛
  // بعد هم لیست‌های روی تخته‌ی ردیس را پاک می‌کند تا دفعه‌ی بعد تازه خوانده شوند.
  // جواب همان چهار عدد نسخه‌ی چهارم است، به‌علاوه‌ی «از هر منبع چند تا» و
  // «کدام آگهی تازه به درد کدام مشتری می‌خورد»؛ شکل قدیمی جواب عوض نشده، فقط فیلد اضافه شده است.
  async refresh(): Promise<RefreshResult> {
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
      // عدد رهن و اجاره (یا قیمت فروش) را همان‌جا که آگهی تمیز می‌شود، از متن قیمت درمی‌آوریم؛
      // اگر قیمت خوانده نشد، خالی می‌مانند و آگهی از جست‌وجوی بودجه کنار می‌ماند.
      // متراژ را هم از تیتر و متن درمی‌آوریم تا «متری» حساب شود.
      const parsed = parsePrice(post.priceText, post.category);
      const fullText = `${post.title}\n${post.description ?? ''}`;
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
        // عکس‌های گالری؛ اگر منبع بیش از یک عکس داده باشد، همه اینجاست.
        imageUrls:
          post.imageUrls && post.imageUrls.length > 0 ? post.imageUrls : null,
        rahnAmount: parsed.rahnAmount,
        ejareAmount: parsed.ejareAmount,
        // قیمت فروش فقط برای خرید؛ برای اجاره خالی است.
        saleAmount: parsed.saleAmount,
        // متراژ؛ اگر خوانده نشد، خالی می‌ماند و متری نشان داده نمی‌شود.
        areaSqm: extractArea(fullText),
        // متن کامل آگهی را هم می‌بریم؛ برای دیوار از صفحه‌ی خود آگهی آمده، برای شیپور از جزئیاتش.
        // اگر متن نبود، خالی می‌ماند و امکانات «معلوم نیست» می‌شود.
        description: post.description || null,
        // امکانات را از روی متن درمی‌آوریم؛ اگر متن نبود، همه‌چیز خالی است،
        // یعنی «معلوم نیست»، نه «ندارد» — روی کارت خاکستری نشان داده می‌شود، نه قرمز.
        features: post.description ? extractFeatures(post.description) : null,
      });
    }
    const saved = await this.repository.upsert(fresh);
    // حافظه‌ی موقت را پاک می‌کنیم تا لیست بعدی از دیتابیس تازه خوانده شود.
    await this.redis.delByPrefix('listings:');
    // از هر منبع چند آگهی خام گرفته شد؛ از روی همان لیست خام می‌شماریم.
    const fetchedBySource = { divar: 0, sheypoor: 0 };
    for (const post of rawPosts) {
      fetchedBySource[post.source]++;
    }
    // آگهی‌های تازه را با مشتری‌های دفترچه جور می‌کنیم؛
    // اگر آگهی تازه‌ای به درد مشتری‌ای خورد، در جواب می‌نویسیم تا چت وضعیت اعلام کند.
    const clientMatches = await this.matchFreshWithClients(fresh);
    return {
      fetched: rawPosts.length,
      added: saved.added,
      skippedAgency,
      total: saved.total,
      fetchedBySource,
      addedBySource: saved.addedBySource,
      clientMatches,
    };
  }

  // آگهی‌های تازه را با همه‌ی مشتری‌های دفترچه جور می‌کند؛
  // هر جفت «آگهی تازه + مشتری» که به هم خوردند، یک ردیف در جواب می‌شود.
  // اگر مشتری‌ای نباشد یا آگهی تازه‌ای نباشد، لیست خالی است.
  private async matchFreshWithClients(fresh: Listing[]): Promise<ClientMatch[]> {
    if (fresh.length === 0) {
      return [];
    }
    let clients: Client[] = [];
    try {
      clients = await this.prisma.client.findMany({ orderBy: { createdAt: 'asc' } });
    } catch (error) {
      this.logger.warn(
        `خواندن مشتری‌ها برای تطبیق نشد: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
    if (clients.length === 0) {
      return [];
    }
    const out: ClientMatch[] = [];
    for (const client of clients) {
      const criteria = clientToCriteria(client);
      const matched = matchListings(fresh, criteria);
      for (const listing of matched) {
        out.push({
          clientId: client.id,
          clientName: client.name,
          token: listing.token,
          title: listing.title,
        });
      }
    }
    return out;
  }

  // آگهی‌های ذخیره‌شده را برمی‌گرداند؛ اگر محله داده شود، فقط همان محله را می‌دهد.
  // جواب ۶۰ ثانیه روی تخته‌ی ردیس می‌ماند؛ اگر ردیس خواب بود، از دیتابیس می‌خوانیم.
  // روی هر آگهی متری و میانگین محله‌اش هم هست.
  async findAll(district?: string): Promise<ListingWithPerMeter[]> {
    const key = district ? `listings:district:${district}` : 'listings:all';
    const cached = await this.redis.get(key);
    if (cached) {
      this.logger.log(`لیست آگهی‌ها از حافظه‌ی ردیس آمد (کلید ${key}).`);
      const parsed = JSON.parse(cached) as Listing[];
      return this.enrich(parsed);
    }
    const all = await this.repository.findAll();
    const result = district ? all.filter((listing) => listing.district.includes(district)) : all;
    await this.redis.set(key, JSON.stringify(result), 60);
    return this.enrich(result);
  }

  // یک آگهی را با شناسه‌اش برمی‌گرداند.
  async findOne(token: string): Promise<ListingWithPerMeter | undefined> {
    const listing = await this.repository.findByToken(token);
    if (!listing) {
      return undefined;
    }
    const [enriched] = await this.enrich([listing]);
    return enriched;
  }

  // آگهی‌های شخصی که «معادل رهن کامل» آن‌ها زیر سقف است؛ نزدیک‌ترین به هدف اول.
  // معادل رهن کامل یعنی رهن + اجاره‌ای که با همان نسبت ۳٪ ماشین‌حساب به رهن برگشته است؛
  // پس هر ترکیبی که به هدف برسد پیدا می‌شود، نه فقط آگهی‌هایی که خود رهنشان برابر هدف است:
  // رهن ۱٫۵ میلیارد + اجاره‌ی ۱۵ میلیون، رهن ۵۰۰ میلیون + اجاره‌ی ۴۵ میلیون،
  // رهن ۲ میلیارد بدون اجاره، و حتی رهن صفر + اجاره‌ی ۶۰ میلیون — همه معادل ۲ میلیاردند.
  // فقط آگهی‌هایی می‌آیند که هر دو عددشان خوانده شده باشد؛ اگر رهن یا اجاره معلوم نباشد،
  // معادلش حدس زده نمی‌شود و آگهی کنار می‌ماند. هیچ‌چیز بالای سقف نمی‌آید.
  async findByBudget(target: number, max: number): Promise<ListingWithPerMeter[]> {
    const all = await this.repository.findAll();
    const results: BudgetListing[] = [];
    for (const listing of all) {
      const equivalent = equivalentRahnOf(listing);
      if (equivalent === null || equivalent <= 0 || equivalent > max) {
        continue;
      }
      results.push({ ...listing, equivalentRahn: equivalent });
    }
    // نزدیک‌ترین به هدف اول؛ یعنی آگهی‌ای که معادلش به هدف نزدیک‌تر است، بالاتر می‌آید.
    results.sort(
      (a, b) => Math.abs(a.equivalentRahn - target) - Math.abs(b.equivalentRahn - target),
    );
    return this.enrich(results);
  }

  // جمله‌ی مشتری را می‌فهمد و آگهی‌های مناسبش را می‌آورد؛ همان «مشتری‌یاب».
  // اگر جمله چیزی نداشت که فهمیده شود، نتیجه خالی است و پیام کمک برمی‌گردد.
  async findByCustomerText(
    text: string,
  ): Promise<{ understood: boolean; summary: string; criteria: ParsedCustomer; results: ListingWithPerMeter[] }> {
    const districts = await this.getDistricts();
    const parsed = parseCustomerSentence(text, districts);
    if (!parsed.understood) {
      return { understood: false, summary: '', criteria: parsed, results: [] };
    }
    const all = await this.repository.findAll();
    const matched = matchListings(all, parsed);
    return {
      understood: true,
      summary: parsed.summary,
      criteria: parsed,
      results: await this.enrich(matched),
    };
  }

  // آگهی‌های مناسب یک مشتری از دفترچه؛ همان منطق «مشتری‌یاب» با خواسته‌های ذخیره‌شده‌ی او.
  // اگر مشتری نبود، خالی برمی‌گردد.
  async findByClient(
    id: number,
  ): Promise<{ client: Client; results: ListingWithPerMeter[] } | null> {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      return null;
    }
    const all = await this.repository.findAll();
    const matched = matchListings(all, clientToCriteria(client));
    return { client, results: await this.enrich(matched) };
  }

  // وضعیت و یادداشت ماهان روی یک آگهی را ذخیره می‌کند؛
  // اگر وضعیت خالی باشد، وضعیت و یادداشت آن آگهی پاک می‌شود.
  // وضعیت در جدول جداست و با تازه‌سازی پاک نمی‌شود.
  async setStatus(
    token: string,
    status: string | null,
    note?: string | null,
  ): Promise<{ token: string; status: string | null; note: string | null }> {
    if (status !== null && !(LISTING_STATUSES as readonly string[]).includes(status)) {
      throw new Error('وضعیت باید یکی از این‌ها باشد: زنگ زدم، بازدید رفت، معامله شد، رد شد');
    }
    const listing = await this.repository.findByToken(token);
    if (!listing) {
      throw new NotFoundException(`آگهی با شناسه‌ی ${token} پیدا نشد`);
    }
    const cleanNote =
      note === undefined ? undefined : note === null ? null : String(note).trim() || null;
    return this.repository.saveStatus(token, status, cleanNote);
  }

  // روی هر آگهی متری و میانگین محله‌اش را می‌گذارد.
  private async enrich(listings: Listing[]): Promise<ListingWithPerMeter[]> {
    const districts = await this.getDistricts();
    return enrichListings(listings, districts);
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

// یک مشتری دفترچه را به همان خواسته‌ای برمی‌گرداند که «مشتری‌یاب» می‌فهمد؛
// پس تطبیق تازه‌سازی و تطبیق مشتری‌یاب دقیقاً یکی‌اند.
export function clientToCriteria(client: Client): MatchCriteria {
  return {
    kind: client.kind === 'buy' ? 'buy' : 'rent',
    maxDeposit: client.maxDeposit ?? null,
    maxRent: client.maxRent ?? null,
    district: client.district ?? null,
    propertyKind: null,
    wantsParking: client.wantsParking,
    wantsStorage: client.wantsStorage,
    wantsElevator: client.wantsElevator,
  };
}

// سقف معادل رهن کامل برای یک خواسته؛ برای خرید خالی است.
export function maxEquivalentFor(criteria: MatchCriteria): number | null {
  return maxEquivalentOf(criteria);
}
