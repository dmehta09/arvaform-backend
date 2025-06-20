import { ApiProperty } from '@nestjs/swagger';
import { SubmissionResponseDto } from './submission-response.dto';

/**
 * DTO for paginated submissions response
 */
export class PaginatedSubmissionsResponseDto {
  @ApiProperty({
    description: 'Array of submissions for the current page',
    type: [SubmissionResponseDto],
  })
  submissions: SubmissionResponseDto[];

  @ApiProperty({
    description: 'Total number of submissions',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages: number;
}
