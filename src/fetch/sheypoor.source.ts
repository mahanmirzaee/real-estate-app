// این فایل منبع شیپور است؛ دومین پیک بنگاه که می‌رود سراغ شیپور و آگهی‌های خام را جمع می‌کند.
// مثل منبع دیوار پشت همان قرارداد «منبع آگهی» است، پس بقیه‌ی کد نمی‌داند آگهی از کجاست.

import { Injectable, Logger } from '@nestjs/common';
import { SHEYPOOR_CATEGORIES, SHEYPOOR_DISTRICT_MAP, SHEYPOOR_NEIGHBOURHOOD_IDS } from '../common/constants';
import { RawPost } from './listing.interface';
import { FetchScope, ListingSource } from './listing-source.interface';
import { SheypoorCard, SheypoorClient, SheypoorDetailAttributes } from './sheypoor.client';

@Injectable()
export class SheypoorSource implements ListingSource {
  readonly source = 'sheypoor' as const;
  private readonly logger = new Logger(SheypoorSource.name);

  constructor(private readonly client: SheypoorClient) {}

  // همه‌ی دسته‌ها را می‌گیرد؛ هر دسته حداکثر دو صفحه، تا کار خیلی طول نکشد.
  // محله‌ها از بیرون می‌آیند (از تنظیمات)؛ اگر داده نشد، همان سه محله‌ی دفترچه‌ی ثابت.
  async fetchAll(maxPages = 2, scope?: FetchScope): Promise<RawPost[]> {
    const all: RawPost[] = [];
    const neighbourhoodIds = scope?.sheypoorNeighbourhoodIds ?? SHEYPOOR_NEIGHBOURHOOD_IDS;
    const districtMap = scope?.sheypoorDistrictMap ?? SHEYPOOR_DISTRICT_MAP;
    for (const category of SHEYPOOR_CATEGORIES) {
      for (let page = 1; page <= maxPages; page++) {
        const body = await this.client.search(category.slug, neighbourhoodIds, page);
        const cards = this.flatten(body.data ?? []);
        // برای هر آگهی، جزئیاتش را هم می‌گیریم تا توضیح واقعی و نشانه‌ی آژانس را داشته باشیم؛
        // سه تا هم‌زمان، نه بیشتر، تا به شیپور فشار نیاید.
        const details = await this.fetchDetails(cards);
        for (const card of cards) {
          const district = this.districtOf(card.attributes?.location, districtMap);
          // آگهی‌ای که محله‌اش یکی از سه محله‌ی ماهان نیست
          // (مثلاً تبلیغ سراسری یا آگهی اطراف که فیلتر را دور زده)، کنار گذاشته می‌شود.
          if (!district || !card.id || !card.attributes?.title) {
            continue;
          }
          const detail = details.get(String(card.id));
          const description = detail ? this.cleanDescription(detail.description) : '';
          // همه‌ی عکس‌های آگهی از جزئیاتش؛ نشانی دسکتاپ بزرگ‌تر است، اگر نبود موبایل.
          // حداکثر ۱۰ تا؛ اگر جزئیات عکسی نداشت، همان عکس تکی کارت می‌ماند.
          const imageUrls = detail
            ? (detail.images ?? [])
                .map((image) => image.source?.desktop ?? image.source?.mobile ?? '')
                .filter((url) => url.startsWith('http'))
                .slice(0, 10)
            : [];
          all.push({
            token: String(card.id),
            title: String(card.attributes.title),
            priceText: this.priceText(card.attributes.price),
            // خط اول محله را می‌گوید («در سید خندان») و بعد توضیح واقعی آگهی می‌آید؛
            // قانون‌های متنی میز دوم روی همین متن کار می‌کنند.
            bottomText: `در ${district}${description ? `\n${description}` : ''}`,
            district,
            category: category.value,
            categoryLabel: category.label,
            source: 'sheypoor',
            url: String(card.attributes.url ?? `https://www.sheypoor.com/v/${card.id}`),
            // عکس آگهی را هم برمی‌داریم؛ شیپور عکس کوچک کارت را در `images.thumbnails.round` می‌دهد.
            imageUrl: card.attributes.images?.thumbnails?.round ?? undefined,
            // عکس‌های گالری از جزئیات؛ اگر نبود، خالی می‌ماند و همان عکس تکی نشان داده می‌شود.
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
            // متن کامل آگهی را جدا هم نگه می‌داریم تا امکانات (پارکینگ، انباری، آسانسور) از رویش دربیاید؛
            // در `bottomText` (باتم‌تکست) هم هست تا قانون‌های متنی میز دوم روی آن کار کنند.
            description: description || undefined,
            // اگر شیپور خودش گفته باشد فروشنده فروشگاه دارد یا مشاور معرفی کرده است، آژانس است.
            isAgency: detail
              ? detail.isShopProfile === true || !!detail.consultant
              : undefined,
          });
        }
        // اگر همه‌ی آگهی‌های این دسته را گرفتیم، صفحه‌ی بعدی نیست.
        const perPage = body.meta?.items_per_page ?? 24;
        const total = body.meta?.normal_count ?? 0;
        if (cards.length === 0 || page * perPage >= total) {
          break;
        }
        // بین صفحه‌ها یک ثانیه صبر می‌کنیم تا به شیپور فشار نیاید.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    this.logger.log(`از شیپور ${all.length} آگهی خام گرفتیم.`);
    return all;
  }

  // از جواب شلوغ شیپور، فقط کارت‌های آگهی را برمی‌داریم؛
  // بنر و ویجت و پیشنهاد جست‌وجو، آگهی نیست و رد می‌شود.
  private flatten(blocks: Array<{ type?: string; items?: SheypoorCard[] } & SheypoorCard>): SheypoorCard[] {
    const cards: SheypoorCard[] = [];
    const seen = new Set<string>();
    for (const block of blocks) {
      const type = block.type;
      const items =
        type === 'special' || type === 'vip'
          ? block.items ?? []
          : type === 'normal' || type === 'paidEngagement' || type === 'nearby'
            ? [block as SheypoorCard]
            : [];
      for (const card of items) {
        if (card.id && card.attributes && !seen.has(String(card.id))) {
          seen.add(String(card.id));
          cards.push(card);
        }
      }
    }
    return cards;
  }

  // جزئیات آگهی‌ها را سه تا سه تا می‌گیریم؛ اگر یکی نشد، آگهی را با همان اطلاعات کارت نگه می‌داریم.
  private async fetchDetails(
    cards: SheypoorCard[],
  ): Promise<Map<string, SheypoorDetailAttributes | null>> {
    const out = new Map<string, SheypoorDetailAttributes | null>();
    let index = 0;
    const workers = Array.from({ length: 3 }, async () => {
      while (index < cards.length) {
        const card = cards[index++];
        const id = String(card.id);
        try {
          out.set(id, await this.client.getListing(id));
        } catch (error) {
          // اگر جزئیات یک آگهی نیامد، آگهی را دور نمی‌اندازیم؛
          // فقط نشانه‌ی آژانس را نداریم و قانون‌های متنی تصمیم می‌گیرند.
          this.logger.warn(`جزئیات آگهی ${id} از شیپور نیامد: ${error instanceof Error ? error.message : String(error)}`);
          out.set(id, null);
        }
      }
    });
    await Promise.all(workers);
    return out;
  }

  // محله را از نشانی آگهی می‌خوانیم؛ مثلاً «تهران، سید خندان» یعنی «سید خندان (جلفا)».
  // نقشه‌ی اسم‌ها از بیرون می‌آید (از تنظیمات)؛ اگر داده نشد، همان نقشه‌ی ثابت قبلی.
  private districtOf(location: string | undefined, districtMap: Record<string, string>): string {
    if (!location) {
      return '';
    }
    const name = location.replace(/^تهران،\s*/, '').trim();
    return districtMap[name] ?? '';
  }

  // قیمت را به زبان آدم می‌نویسیم؛ برای اجاره، رهن و اجاره جدا گفته می‌شود.
  private priceText(price: Array<{ label?: string | null; amount?: string | number | null }> | undefined): string {
    if (!price || price.length === 0) {
      return 'قیمت توافقی';
    }
    const parts = price
      .filter((p) => p.amount !== null && p.amount !== undefined && String(p.amount) !== '')
      .map((p) => {
        const amount = String(p.amount);
        return p.label ? `${p.label}: ${amount} تومان` : `قیمت: ${amount} تومان`;
      });
    return parts.length > 0 ? parts.join('، ') : 'قیمت توافقی';
  }

  // توضیح آگهی را از نشانه‌های اینترنتی تمیز می‌کنیم؛ شماره‌ی پنهان‌شده هم برداشته می‌شود.
  private cleanDescription(description: string | undefined): string {
    if (!description) {
      return '';
    }
    const withoutPhone = description.replace(/<span[^>]*>.*?<\/span>/gs, '');
    const text = withoutPhone
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n')
      .slice(0, 1000);
  }
}
