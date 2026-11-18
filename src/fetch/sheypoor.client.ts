// این فایل فقط با سایت شیپور حرف می‌زند؛ مثل پیک دوم بنگاه که می‌رود و برمی‌گردد.
// شیپور برخلاف دیوار `API` (ای‌پی‌آی) رسمی برای جست‌وجو ندارد، ولی سایت خودش
// از یک `API` (ای‌پی‌آی) عمومی `JSON` (جیسون) استفاده می‌کند
// (`https://www.sheypoor.com/api/v10.0.0` — ای‌پی‌آی وی‌تن) و ما همان را صدا می‌زنیم؛
// یعنی به‌جای خواندن صفحه‌ی اینترنتی، مستقیم جواب آماده می‌گیریم.
// هیچ تصمیمی اینجا گرفته نمی‌شود؛ فقط آگهی خام را می‌آورد و تحویل می‌دهد.

// `Injectable` (اینجکتبل) یعنی: «این کلاس را `NestJS` (نست‌جی‌اس) بسازد
// و هر جا که لازم بود، تحویل بدهد.»
import { Injectable } from '@nestjs/common';
import { SHEYPOOR_API_URL, USER_AGENT } from '../common/constants';

// شکل جواب جست‌وجوی شیپور؛ هر آگهی یک «کارت» است که داخل بلوک‌هاست.
export interface SheypoorSearchResponse {
  data?: Array<{
    type?: string;
    items?: SheypoorCard[];
    id?: string;
    attributes?: SheypoorCardAttributes;
  }>;
  meta?: { normal_count?: number; total?: number; items_per_page?: number; p?: number };
}

export interface SheypoorCardAttributes {
  title?: string;
  url?: string;
  location?: string;
  timePassedLabel?: string;
  price?: Array<{ label?: string | null; amount?: string | number | null }>;
  categories?: Array<{ name?: string }>;
  // عکس‌های آگهی؛ `thumbnails.round` (تامبنیلز راوند) همان عکس کوچک کارت است.
  images?: { thumbnails?: { round?: string; landscape?: string } };
}

export interface SheypoorCard {
  id?: string;
  type?: string;
  attributes?: SheypoorCardAttributes;
  fullAttributes?: Array<{ key?: string; value?: string }>;
}

// شکل جواب جزئیات یک آگهی؛ فقط همان چیزی که لازم داریم.
export interface SheypoorDetailAttributes {
  title?: string;
  url?: string;
  location?: string;
  description?: string;
  isShopProfile?: boolean;
  consultant?: Record<string, unknown> | null;
  seller?: { name?: string };
  // همه‌ی عکس‌های آگهی؛ هر عکس یک نشانی بزرگ دسکتاپ و یک نشانی موبایل دارد.
  // برای گالری کارت، نشانی دسکتاپ را می‌گیریم؛ اگر نبود، موبایل.
  images?: Array<{ source?: { desktop?: string; mobile?: string } }>;
}

@Injectable()
export class SheypoorClient {
  // یک دسته را در سه محله‌ی ماهان می‌گیرد؛ مثلاً همه‌ی «رهن و اجاره آپارتمان»‌ها را.
  // اگر صفحه‌ی دوم را بخواهیم، شماره‌ی صفحه را می‌دهیم.
  async search(
    categorySlug: string,
    neighbourhoodIds: string[],
    page = 1,
  ): Promise<SheypoorSearchResponse> {
    // نشانی جست‌وجو؛ محله‌ها با `nh[]` (ان‌اچ) داده می‌شوند و `o=n` (او مساوی ان) یعنی «جدیدترین اول».
    const query = `o=n&${neighbourhoodIds.map((id) => `nh[]=${id}`).join('&')}${page > 1 ? `&p=${page}` : ''}`;
    const url = `${SHEYPOOR_API_URL}/search/tehran/${categorySlug}?${query}`;
    return this.getJson<SheypoorSearchResponse>(url, `search ${categorySlug} page ${page}`);
  }

  // جزئیات یک آگهی را با شناسه‌اش می‌گیرد؛ اگر آگهی پاک شده باشد، خالی برمی‌گرداند.
  async getListing(id: string): Promise<SheypoorDetailAttributes | null> {
    const url = `${SHEYPOOR_API_URL}/listings/${id}`;
    try {
      const body = await this.getJson<{ data?: { attributes?: SheypoorDetailAttributes } }>(
        url,
        `listing ${id}`,
      );
      return body.data?.attributes ?? null;
    } catch (error) {
      // آگهی‌ای که نیست (۴۰۴) یعنی پاک شده است؛ خطا نیست، فقط خالی برمی‌گردانیم.
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // یک درخواست `JSON` (جیسون) می‌فرستد و جواب را برمی‌گرداند؛
  // اگر شیپور جواب نداد، سه بار تلاش می‌کنیم؛ مثل اینکه سه بار زنگ بزنیم.
  private async getJson<T>(url: string, what: string): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // اگر شیپور تا ۳۰ ثانیه جواب نداد، صبر نمی‌کنیم و تلاش بعدی را شروع می‌کنیم.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              Accept: 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
              Referer: 'https://www.sheypoor.com/',
              'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
              'User-Agent': USER_AGENT,
            },
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Sheypoor answered with status ${response.status}`);
          }
          return (await response.json()) as T;
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = error;
        // بین هر تلاش کمی صبر می‌کنیم؛ تلاش دوم ۲ ثانیه و تلاش سوم ۴ ثانیه.
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }
    }
    throw new Error(`Sheypoor API failed for ${what}: ${String(lastError)}`);
  }
}
