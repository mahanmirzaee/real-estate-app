// این فایل دفترچه‌ی مشتری‌هاست؛ مشتری‌ها را می‌سازد، می‌خواند و پاک می‌کند.
// مشتری فقط یک خواسته‌ی ذخیره‌شده است؛ تطبیقش با آگهی‌ها جای دیگری انجام می‌شود
// (در سرویس آگهی‌ها، با همان منطق «مشتری‌یاب»).

import { Injectable, NotFoundException } from '@nestjs/common';
import { Client } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// چیزی که از فرم افزودن مشتری می‌آید؛ همه‌ی عددها به تومان‌اند و اختیاری‌اند.
export interface CreateClientInput {
  // اسم مشتری؛ مثلاً «آقای رضایی».
  name: string;
  // دنبال اجاره است یا خرید؛ 'rent' یعنی اجاره، 'buy' یعنی خرید.
  kind: 'rent' | 'buy';
  // سقف ودیعه برای اجاره، سقف قیمت کل برای خرید.
  maxDeposit?: number | null;
  // سقف اجاره‌ی ماهانه؛ فقط برای اجاره معنی دارد.
  maxRent?: number | null;
  // محله‌ای که می‌خواهد؛ اگر خالی باشد یعنی هر محله‌ای.
  district?: string | null;
  // نوع ملک؛ 'apartment' یعنی مسکونی، 'office' یعنی دفترکار، 'land' یعنی زمین.
  // اگر خالی باشد یعنی هر نوعی.
  propertyKind?: 'apartment' | 'office' | 'land' | null;
  // این امکانات را می‌خواهد؟ درست یعنی «می‌خواهد»، غلط یعنی «فرقی نمی‌کند».
  wantsParking?: boolean;
  wantsStorage?: boolean;
  wantsElevator?: boolean;
  // یادداشت کوتاه ماهان درباره‌ی این مشتری.
  note?: string | null;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  // همه‌ی مشتری‌ها؛ تازه‌ترین اول.
  async findAll(): Promise<Client[]> {
    return this.prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // یک مشتری را با شناسه‌اش می‌دهد؛ اگر نبود، خالی است.
  async findOne(id: number): Promise<Client | null> {
    return this.prisma.client.findUnique({ where: { id } });
  }

  // یک مشتری تازه می‌سازد؛ اسم و نوع لازم‌اند، بقیه اختیاری‌اند.
  // عدد منفی قبول نیست؛ عدد صفر یعنی «سقفی ندارد» و خالی ذخیره می‌شود.
  async create(input: CreateClientInput): Promise<Client> {
    const name = String(input.name ?? '').trim();
    if (name.length === 0) {
      throw new Error('اسم مشتری لازم است');
    }
    if (input.kind !== 'rent' && input.kind !== 'buy') {
      throw new Error('نوع مشتری باید اجاره یا خرید باشد');
    }
    const propertyKind =
      input.propertyKind === 'apartment' ||
      input.propertyKind === 'office' ||
      input.propertyKind === 'land'
        ? input.propertyKind
        : null;
    const amount = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') {
        return null;
      }
      const num = Number(value);
      if (!Number.isFinite(num) || num < 0) {
        throw new Error('عددها باید صفر یا بزرگ‌تر باشند');
      }
      return num === 0 ? null : Math.round(num);
    };
    return this.prisma.client.create({
      data: {
        name,
        kind: input.kind,
        maxDeposit: amount(input.maxDeposit),
        maxRent: input.kind === 'rent' ? amount(input.maxRent) : null,
        district: input.district ? String(input.district).trim() || null : null,
        propertyKind,
        wantsParking: input.wantsParking === true,
        wantsStorage: input.wantsStorage === true,
        wantsElevator: input.wantsElevator === true,
        note: input.note ? String(input.note).trim() || null : null,
      },
    });
  }

  // یک مشتری را پاک می‌کند؛ اگر نبود، خطای ۴۰۴ می‌دهد.
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`مشتری با شناسه‌ی ${id} پیدا نشد`);
    }
    await this.prisma.client.delete({ where: { id } });
  }
}
