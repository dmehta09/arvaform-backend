import { ApiProperty } from '@nestjs/swagger';
import { FormResponseDto } from './form-response.dto';

/**
 * DTO for paginated forms response with metadata
 */
export class PaginatedFormsDto {
  @ApiProperty({
    description: 'Array of forms for current page',
    type: [FormResponseDto],
  })
  data: FormResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      hasNextPage: true,
      nextCursor: '2025-01-15T10:30:00.000Z',
      totalCount: 50,
      limit: 10,
    },
  })
  pagination: {
    hasNextPage: boolean;
    nextCursor: string | null;
    totalCount: number;
    limit: number;
  };

  @ApiProperty({
    description: 'Applied filters for the query',
    example: {
      search: 'contact form',
      status: 'published',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
  })
  filters: {
    search?: string;
    status?: string;
    sortBy: string;
    sortOrder: string;
    createdAfter?: string;
    createdBefore?: string;
    updatedAfter?: string;
    updatedBefore?: string;
  };
}
