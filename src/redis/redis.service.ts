// این فایل نگهبان حافظه‌ی موقت است: با `Redis` (ردیس) حرف می‌زند.
// ردیس مثل یک تخته‌ی کوچک کنار دست بنگاه است؛ جواب‌هایی که تازه گرفتیم را
// چند ثانیه روی تخته می‌نویسیم تا اگر همان سؤال دوباره آمد، نرویم سراغ انبار.
// اگر ردیس خاموش باشد، برنامه نمی‌ایستد؛ فقط تخته خالی می‌ماند و جواب از دیتابیس می‌آید.
// پس ردیس فقط «حافظه‌ی موقت» است و هیچ‌وقت جای دیتابیس را نمی‌گیرد.

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private available = true;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.client = new Redis(url, {
      // اگر ردیس جواب نداد، اتصال را در پس‌زمینه دوباره امتحان می‌کند؛
      // ما فقط می‌خواهیم برنامه نایستد و خطا را هم یک بار بنویسیم، نه هزار بار.
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    this.client.on('error', (error: Error) => {
      if (this.available) {
        this.available = false;
        this.logger.warn(`ردیس در دسترس نیست؛ فعلاً همه‌چیز از دیتابیس خوانده می‌شود. (${error.message})`);
      }
    });
    this.client.on('ready', () => {
      if (!this.available) {
        this.available = true;
        this.logger.log('ردیس دوباره وصل شد.');
      }
    });
    // اتصال را شروع می‌کنیم؛ اگر نشد، رویداد خطا آن را می‌گوید و برنامه نمی‌ایستد.
    this.client.connect().catch(() => undefined);
  }

  // یک مقدار را با کلیدش می‌خواند؛ اگر نبود یا ردیس خواب بود، خالی برمی‌گرداند.
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      this.markDown();
      return null;
    }
  }

  // یک مقدار را با کلیدش می‌نویسد و بعد از چند ثانیه خودش پاک می‌شود.
  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch {
      this.markDown();
    }
  }

  // همه‌ی کلیدهایی که با این شروع می‌شوند را پاک می‌کند؛
  // مثلاً بعد از تازه‌سازی، همه‌ی لیست‌های ذخیره‌شده روی تخته پاک می‌شوند.
  async delByPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      this.markDown();
    }
  }

  private markDown(): void {
    if (this.available) {
      this.available = false;
      this.logger.warn('ردیس جواب نداد؛ فعلاً همه‌چیز از دیتابیس خوانده می‌شود.');
    }
  }

  // وقتی برنامه خاموش می‌شود، اتصال ردیس را هم تمیز قطع می‌کنیم.
  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
