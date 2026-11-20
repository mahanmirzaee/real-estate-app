// این فایل درِ ورودی دفترچه‌ی مشتری‌هاست؛ مشتری‌ها از اینجا اضافه و خوانده می‌شوند.
// `Controller` (کنترلر) یعنی دربان؛ درخواست را می‌گیرد و جواب را پس می‌دهد.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListingsService } from '../listings/listings.service';
import { ClientsService, CreateClientInput } from './clients.service';

@ApiTags('clients — مشتری‌ها')
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly listings: ListingsService,
  ) {}

  // همه‌ی مشتری‌ها؛ تازه‌ترین اول.
  // کنار هر مشتری، چند آگهی به دردش می‌خورد هم هست (`matchCount` — مچ کانت).
  @Get()
  @ApiOperation({ summary: 'فهرست مشتری‌های دفترچه' })
  @ApiResponse({ status: 200, description: 'لیست مشتری‌ها' })
  async findAll() {
    const clients = await this.clients.findAll();
    const withCounts = await Promise.all(
      clients.map(async (client) => ({
        ...client,
        matchCount: (await this.listings.countMatchesForClient(client.id)) ?? 0,
      })),
    );
    return withCounts;
  }

  // یک مشتری تازه می‌سازد؛ اسم و نوع لازم‌اند.
  @Post()
  @ApiOperation({ summary: 'افزودن یک مشتری تازه به دفترچه' })
  @ApiResponse({ status: 201, description: 'مشتری ساخته شد' })
  @ApiResponse({ status: 400, description: 'اسم یا نوع یا عددها درست نیستند' })
  async create(@Body() body: CreateClientInput) {
    try {
      return await this.clients.create(body ?? ({} as CreateClientInput));
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'مشتری ساخته نشد');
    }
  }

  // آگهی‌های مناسب یک مشتری؛ همان منطق «مشتری‌یاب» با خواسته‌های ذخیره‌شده‌ی او.
  @Get(':id/matches')
  @ApiOperation({ summary: 'آگهی‌های مناسب یک مشتری' })
  @ApiResponse({ status: 200, description: 'مشتری و آگهی‌های مناسبش' })
  @ApiResponse({ status: 404, description: 'مشتری پیدا نشد' })
  async matches(@Param('id') idRaw: string) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('شناسه‌ی مشتری درست نیست');
    }
    const found = await this.listings.findByClient(id);
    if (!found) {
      throw new NotFoundException(`مشتری با شناسه‌ی ${id} پیدا نشد`);
    }
    return found;
  }

  // یک مشتری را پاک می‌کند.
  @Delete(':id')
  @ApiOperation({ summary: 'حذف یک مشتری از دفترچه' })
  @ApiResponse({ status: 200, description: 'مشتری حذف شد' })
  @ApiResponse({ status: 404, description: 'مشتری پیدا نشد' })
  async remove(@Param('id') idRaw: string) {
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('شناسه‌ی مشتری درست نیست');
    }
    await this.clients.remove(id);
    return { deleted: id };
  }
}
