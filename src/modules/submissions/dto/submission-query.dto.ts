import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsPositive, Max, Min } from 'class-validator';

/**
 * DTO for querying submissions with filtering and pagination
 */
export class SubmissionQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by submission status',
    enum: ['draft', 'submitted', 'completed', 'processed', 'archived'],
    example: 'completed',
  })
  @IsOptional()
  @IsEnum(['draft', 'submitted', 'completed', 'processed', 'archived'])
  status?: 'draft' | 'submitted' | 'completed' | 'processed' | 'archived';

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['submittedAt', 'status', 'submitterEmail'],
    example: 'submittedAt',
  })
  @IsOptional()
  @IsEnum(['submittedAt', 'status', 'submitterEmail'])
  sortBy?: 'submittedAt' | 'status' | 'submitterEmail' = 'submittedAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by submitter email',
    example: 'user@example.com',
  })
  @IsOptional()
  submitterEmail?: string;

  @ApiPropertyOptional({
    description: 'Filter by date range start (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(String(value)) : undefined))
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by date range end (ISO string)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(String(value)) : undefined))
  endDate?: Date;
}
