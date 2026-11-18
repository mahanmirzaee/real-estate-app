// این فایل فقط با سایت دیوار حرف می‌زند؛ مثل پیک بنگاه که می‌رود و برمی‌گردد.
// هیچ تصمیمی اینجا گرفته نمی‌شود؛ فقط آگهی خام را می‌آورد و تحویل می‌دهد.

// `Injectable` (اینجکتبل) یعنی: «این کلاس را `NestJS` (نست‌جی‌اس) بسازد
// و هر جا که لازم بود، تحویل بدهد.»
import { Injectable } from '@nestjs/common';
import {
  DISTRICT_IDS,
  DIVAR_API_URL,
  DIVAR_POST_API_URL,
  TEHRAN_CITY_ID,
  USER_AGENT,
} from '../common/constants';

// شکل جوابی که دیوار برمی‌گرداند.
export interface DivarSearchResponse {
  list_widgets?: Array<{ data?: Record<string, any> }>;
  pagination?: { has_next_page?: boolean; data?: unknown };
}

// شکل صفحه‌ی یک آگهی؛ بخش‌ها و ویجت‌ها تو در تو هستند.
export interface DivarPostResponse {
  sections?: Array<{
    widgets?: Array<{ data?: Record<string, any> }>;
  }>;
}

@Injectable()
export class DivarClient {
  // یک دسته را از دیوار می‌گیرد؛ مثلاً همه‌ی «رهن و اجاره آپارتمان»‌ها را.
  // اگر صفحه‌ی دوم را بخواهیم، نشانی ادامه‌ی کار (paginationData) را می‌دهیم.
  async search(category: string, paginationData?: unknown): Promise<DivarSearchResponse> {
    // بدنه‌ی درخواستی که دیوار از ما می‌خواهد؛ دقیقاً همان چیزی که اسکریپت قدیمی می‌فرستاد.
    const body: Record<string, unknown> = {
      city_ids: [TEHRAN_CITY_ID],
      search_data: {
        form_data: {
          data: {
            category: { str: { value: category } },
            districts: { repeated_string: { value: DISTRICT_IDS } },
            sort: { str: { value: 'sort_date' } },
          },
        },
      },
      pagination_data: paginationData ?? this.firstPagePagination(),
    };

    let lastError: unknown;
    // اگر دیوار جواب نداد، سه بار تلاش می‌کنیم؛ مثل اینکه سه بار زنگ بزنیم.
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // اگر دیوار تا ۳۰ ثانیه جواب نداد، صبر نمی‌کنیم و تلاش بعدی را شروع می‌کنیم.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        try {
          const response = await fetch(DIVAR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Divar answered with status ${response.status}`);
          }
          return (await response.json()) as DivarSearchResponse;
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
    throw new Error(`Divar API failed for ${category}: ${String(lastError)}`);
  }

  // متن کامل یک آگهی را از صفحه‌ی خودش می‌گیرد؛ مثل اینکه آگهی را باز کنی و توضیحش را بخوانی.
  // لیست جست‌وجو متن کامل را ندارد؛ فقط صفحه‌ی آگهی دارد.
  // اگر صفحه نیامد یا توضیحی نداشت، خالی برمی‌گرداند؛ خطا نمی‌دهد تا تازه‌سازی نایستد.
  async getPostDescription(token: string): Promise<string> {
    const url = `${DIVAR_POST_API_URL}/${token}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': USER_AGENT },
          signal: controller.signal,
        });
        if (!response.ok) {
          return '';
        }
        const body = (await response.json()) as DivarPostResponse;
        return extractDescription(body);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // اگر صفحه‌ی آگهی نیامد، متن را خالی می‌گذاریم؛
      // امکانات آن آگهی «معلوم نیست» می‌شود، ولی آگهی دور انداخته نمی‌شود.
      return '';
    }
  }

  // نشانی صفحه‌ی اول؛ دیوار برای صفحه‌ی اول این شکل را می‌خواهد.
  private firstPagePagination(): Record<string, unknown> {
    return {
      '@type': 'type.googleapis.com/post_list.PaginationData',
      page: 1,
      layer_page: 1,
      server_payload: {
        '@type': 'type.googleapis.com/post_list.ServerPayload',
        request_payload: {
          '@type': 'type.googleapis.com/post_list.SearchRequestPayload',
        },
      },
    };
  }
}

// از صفحه‌ی آگهی، متن توضیحات را بیرون می‌کشد.
// صفحه بخش‌بخش است؛ بخشی که تیترش «توضیحات» است، متن واقعی آگهی را دارد.
// بقیه‌ی متن‌ها (مثل «انتشار آگهی: ...») توضیح آگهی نیستند و برداشته نمی‌شوند.
function extractDescription(body: DivarPostResponse): string {
  const sections = body.sections ?? [];
  for (const section of sections) {
    const widgets = section.widgets ?? [];
    // در این بخش دنبال تیتر «توضیحات» می‌گردیم؛
    // اولین متن بعد از آن تیتر، همان توضیح آگهی است.
    let foundTitle = false;
    for (const widget of widgets) {
      const data = widget.data ?? {};
      const type = String(data['@type'] ?? '');
      // تیتر «توضیحات» در فیلد `text` (تکست) است، نه `title` (تایتل)؛
      // هر دو را می‌پرسیم تا اگر دیوار جایش را عوض کرد، باز هم پیدا شود.
      const label = String(data.title ?? data.text ?? '');
      if (type.endsWith('TitleRowData') && label === 'توضیحات') {
        foundTitle = true;
        continue;
      }
      if (foundTitle && type.endsWith('DescriptionRowData')) {
        const text = String(data.text ?? '').trim();
        if (text.length > 0) {
          return text.slice(0, 2000);
        }
      }
    }
  }
  return '';
}
