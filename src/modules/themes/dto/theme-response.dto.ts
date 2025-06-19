import { ApiProperty } from '@nestjs/swagger';
import { ThemeDocument } from '../entities/theme.entity';

export class PaginatedThemesResponse {
  @ApiProperty({ type: [Object], description: 'Array of themes' })
  themes: ThemeDocument[];

  @ApiProperty({ description: 'Total number of themes' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

export interface ThemeFilter {
  userId?: string;
  isPublic?: boolean;
  name?: {
    $regex: string;
    $options: string;
  };
  tags?: {
    $in: string[];
  };
}

export interface ThemeSort {
  [key: string]: 1 | -1;
}
