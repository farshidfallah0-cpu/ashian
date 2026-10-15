import { isPublicId, paginationSchema } from '@ashian/shared';
import { BadRequestException, NotFoundException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** شناسه‌ی عمومی آگهی؛ فرمت نامعتبر یعنی چنین آگهی‌ای وجود ندارد (۴۰۴، نه ۴۰۰) */
export class PublicIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isPublicId(value)) throw new NotFoundException('آگهی پیدا نشد');
    return value;
  }
}

export class UuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!z.uuid().safeParse(value).success) throw new BadRequestException('شناسه نامعتبر است');
    return value;
  }
}

export const parsePagination = (query: Record<string, unknown>) => {
  const result = paginationSchema.safeParse(query);
  if (!result.success) throw new BadRequestException('پارامترهای صفحه‌بندی نامعتبر است');
  return result.data;
};

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
