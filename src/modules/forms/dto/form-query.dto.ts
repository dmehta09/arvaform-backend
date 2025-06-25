import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum FormStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum SortBy {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  TITLE = 'title',
  SUBMISSIONS = 'submissions',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * DTO for form query parameters including pagination and search
 */
export class FormQueryDto {
  @ApiPropertyOptional({
    description: 'Search term for title and description',
    example: 'contact form',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (ISO date string)',
    example: '2025-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(String(value), 10))
  @IsNumber({}, { message: 'Limit must be a number' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by form status',
    enum: FormStatus,
    example: FormStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(FormStatus)
  status?: FormStatus;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: SortBy,
    default: SortBy.UPDATED_AT,
    example: SortBy.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy = SortBy.UPDATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Filter forms created after this date',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter forms created before this date',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @ApiPropertyOptional({
    description: 'Filter forms updated after this date',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  updatedAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter forms updated before this date',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  updatedBefore?: string;
}
