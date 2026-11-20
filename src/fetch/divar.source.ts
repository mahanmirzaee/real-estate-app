// این فایل منبع دیوار است؛ همان کاری که میز اول قبلاً مستقیم انجام می‌داد،
// حالا پشت قرارداد «منبع آگهی» است تا شیپور هم کنارش بنشیند.
// این فایل فقط با سایت دیوار حرف می‌زند؛ مثل پیک بنگاه که می‌رود و برمی‌گردد.

import { Injectable, Logger } from '@nestjs/common';
import { AGENCY_WORDS, BLACKLIST_PHRASES, CATEGORIES, DISTRICT_IDS } from '../common/constants';
import { DivarClient } from './divar.client';
import { RawPost } from './listing.interface';
import { FetchScope, ListingSource } from './listing-source.interface';

@Injectable()
export class DivarSource implements ListingSource {
  readonly source = 'divar' as const;
  private readonly logger = new Logger(DivarSource.name);

  constructor(private readonly divar: DivarClient) {}

  // همه‌ی دسته‌ها را می‌گیرد؛ هر دسته حداکثر دو صفحه، تا کار خیلی طول نکشد.
  // محله‌ها از بیرون می‌آیند (از تنظیمات)؛ اگر داده نشد، همان سه محله‌ی دفترچه‌ی ثابت.
  async fetchAll(maxPages = 2, scope?: FetchScope): Promise<RawPost[]> {
    const all: RawPost[] = [];
    const districtIds = scope?.divarDistrictIds ?? DISTRICT_IDS;
    for (const category of CATEGORIES) {
      let paginationData: unknown;
      for (let page = 1; page <= maxPages; page++) {
        const response = await this.divar.search(category.value, paginationData, districtIds);
        for (const post of this.extractPosts(response)) {
          all.push({
            ...post,
            category: category.value,
            categoryLabel: category.label,
            source: 'divar',
            url: `https://divar.ir/v/${post.token}`,
          });
        }
        // اگر دیوار گفت صفحه‌ی بعدی نیست، دیگر ادامه نمی‌دهیم.
        if (!response.pagination?.has_next_page || !response.pagination?.data) {
          break;
        }
        paginationData = response.pagination.data;
        // بین صفحه‌ها یک ثانیه صبر می‌کنیم تا به دیوار فشار نیاید.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    // برای آگهی‌هایی که با قانون‌های متنی شخصی به نظر می‌رسند،
    // صفحه‌ی خود آگهی را هم می‌گیریم تا متن کامل و عکس‌هایش را داشته باشیم؛
    // امکانات (پارکینگ، انباری، آسانسور) فقط از روی متن کامل معلوم می‌شود
    // و گالری عکس هم فقط در صفحه‌ی آگهی است.
    // آگهی آژانس را نمی‌گیریم چون دور انداخته می‌شود و گرفتن صفحه‌اش وقت تلف کردن است.
    await this.attachDetails(all);
    return all;
  }

  // صفحه‌ی آگهی‌ها را سه تا سه تا می‌گیریم؛ اگر یکی نشد، آگهی را با همان اطلاعات لیست نگه می‌داریم.
  private async attachDetails(posts: RawPost[]): Promise<void> {
    const candidates = posts.filter((post) => this.looksPersonal(post));
    let index = 0;
    const workers = Array.from({ length: 3 }, async () => {
      while (index < candidates.length) {
        const post = candidates[index++];
        const detail = await this.divar.getPostDetail(post.token);
        post.description = detail.description || undefined;
        // عکس‌های گالری؛ اگر صفحه عکسی نداشت، همان عکس تکی لیست می‌ماند.
        post.imageUrls = detail.imageUrls.length > 0 ? detail.imageUrls : undefined;
        // تاریخ انتشار از صفحه‌ی آگهی؛ اگر صفحه تاریخ نداشت، خالی می‌ماند.
        post.publishedAt = detail.publishedAt ?? undefined;
      }
    });
    await Promise.all(workers);
    this.logger.log(`متن کامل ${candidates.length} آگهی دیوار گرفته شد.`);
  }

  // آیا آگهی با قانون‌های متنی شخصی به نظر می‌رسد؟
  // همان قانون‌های میز دوم است (محله گفته شده باشد، کلمه‌ی آژانس نباشد، جمله‌ی ممنوعه نباشد)؛
  // اینجا فقط برای این است که صفحه‌ی آگهی‌های آژانس را بیهوده نگیریم.
  // تصمیم نهایی هنوز با میز دوم است و اینجا چیزی رد نمی‌شود.
  private looksPersonal(post: RawPost): boolean {
    const bottom = post.bottomText || '';
    const mentionsDistrict = bottom.includes(' در ') || bottom.startsWith('در ');
    if (!mentionsDistrict) {
      return false;
    }
    if (AGENCY_WORDS.some((word) => bottom.includes(word))) {
      return false;
    }
    return !BLACKLIST_PHRASES.some(
      (phrase) => post.title.includes(phrase) || bottom.includes(phrase),
    );
  }

  // از جواب شلوغ دیوار، فقط آگهی‌هایی را برمی‌داریم که شناسه و تیتر دارند.
  private extractPosts(response: { list_widgets?: Array<{ data?: Record<string, any> }> }): Omit<
    RawPost,
    'category' | 'categoryLabel' | 'source' | 'url'
  >[] {
    const posts: Omit<RawPost, 'category' | 'categoryLabel' | 'source' | 'url'>[] = [];
    for (const widget of response.list_widgets ?? []) {
      const data = widget?.data;
      if (data?.token && data?.title) {
        posts.push({
          token: String(data.token),
          title: String(data.title),
          // قیمت را از دو تکه‌ی دیوار می‌سازیم: بالای آگهی «ودیعه» را می‌گوید
          // و وسطش «اجاره» یا «رهن کامل» را؛ هر دو را کنار هم می‌گذاریم تا
          // عدد رهن و اجاره هر دو در متن قیمت باشند و بعداً خوانده شوند.
          // اگر یکی از دو تکه خالی بود، فقط همان یکی که هست می‌ماند.
          priceText: [data.top_description_text, data.middle_description_text]
            .map((part) => String(part ?? '').trim())
            .filter((part) => part.length > 0)
            .join('، '),
          bottomText: String(data.bottom_description_text ?? ''),
          district: this.districtOf(data),
          // عکس آگهی را هم برمی‌داریم؛ دیوار نشانی عکس را در فیلد `image_url` می‌دهد.
          // اگر آگهی عکس نداشت، این فیلد خالی است و بعداً جای عکس خالی می‌ماند.
          imageUrl: data.image_url ? String(data.image_url) : undefined,
        });
      }
    }
    return posts;
  }

  // محله را اول از فیلد آماده‌ی دیوار می‌خوانیم و اگر نبود، از آخر توضیح آگهی درمی‌آوریم.
  private districtOf(data: Record<string, any>): string {
    const direct = data.web_info?.district_persian;
    if (direct) {
      return String(direct);
    }
    const bottom = String(data.bottom_description_text ?? '');
    const match = /در (.+)$/.exec(bottom);
    return match ? match[1].trim() : '';
  }
}
