// این فایل برای هر پنج دسته می‌رود سراغ دیوار و آگهی‌های خام را جمع می‌کند.
// مثل پیک بنگاه که برای هر محله یک دور می‌زند و فایل‌ها را برمی‌دارد.

import { Injectable } from '@nestjs/common';
import { CATEGORIES } from '../common/constants';
import { DivarClient } from './divar.client';
import { RawPost } from './listing.interface';

@Injectable()
export class FetchService {
  constructor(private readonly divar: DivarClient) {}

  // همه‌ی دسته‌ها را می‌گیرد؛ هر دسته حداکثر دو صفحه، تا کار خیلی طول نکشد.
  async fetchAll(maxPages = 2): Promise<RawPost[]> {
    const all: RawPost[] = [];
    for (const category of CATEGORIES) {
      let paginationData: unknown;
      for (let page = 1; page <= maxPages; page++) {
        const response = await this.divar.search(category.value, paginationData);
        for (const post of this.extractPosts(response)) {
          all.push({ ...post, category: category.value, categoryLabel: category.label });
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
    return all;
  }

  // از جواب شلوغ دیوار، فقط آگهی‌هایی را برمی‌داریم که شناسه و تیتر دارند.
  private extractPosts(response: { list_widgets?: Array<{ data?: Record<string, any> }> }): Omit<RawPost, 'category' | 'categoryLabel'>[] {
    const posts: Omit<RawPost, 'category' | 'categoryLabel'>[] = [];
    for (const widget of response.list_widgets ?? []) {
      const data = widget?.data;
      if (data?.token && data?.title) {
        posts.push({
          token: String(data.token),
          title: String(data.title),
          priceText: String(data.middle_description_text ?? ''),
          bottomText: String(data.bottom_description_text ?? ''),
          district: this.districtOf(data),
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
