import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * Export format options
 */
export enum ExportFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
}

/**
 * Export compression options
 */
export enum CompressionType {
  NONE = 'none',
  ZIP = 'zip',
  GZIP = 'gzip',
}

/**
 * Date range filter for exports
 */
export class ExportDateRangeDto {
  @ApiProperty({
    description: 'Start date for export range (ISO string)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  start: string;

  @ApiProperty({
    description: 'End date for export range (ISO string)',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsNotEmpty()
  end: string;
}

/**
 * Export filter configuration
 */
export class ExportFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by submission status',
    enum: ['draft', 'submitted', 'processed', 'archived'],
    isArray: true,
    example: ['submitted', 'processed'],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(['draft', 'submitted', 'processed', 'archived'], { each: true })
  status?: string[];

  @ApiPropertyOptional({
    description: 'Filter by submitter email',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  submitterEmail?: string;

  @ApiPropertyOptional({
    description: 'Date range filter',
    type: ExportDateRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExportDateRangeDto)
  dateRange?: ExportDateRangeDto;

  @ApiPropertyOptional({
    description: 'Filter by specific submission IDs',
    isArray: true,
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  submissionIds?: string[];

  @ApiPropertyOptional({
    description: 'Filter by minimum spam score',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  minSpamScore?: number;

  @ApiPropertyOptional({
    description: 'Include only GDPR compliant submissions',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  gdprCompliant?: boolean;
}

/**
 * Export template configuration
 */
export class ExportTemplateDto {
  @ApiProperty({
    description: 'Template name',
    example: 'monthly-report',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Included fields',
    isArray: true,
    example: ['submitterEmail', 'submittedAt', 'status', 'data'],
  })
  @IsArray()
  @IsString({ each: true })
  fields: string[];

  @ApiPropertyOptional({
    description: 'Pre-configured filters',
    type: ExportFiltersDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExportFiltersDto)
  filters?: ExportFiltersDto;
}

/**
 * Main export options DTO with comprehensive configuration
 */
export class ExportOptionsDto {
  @ApiProperty({
    description: 'Export format',
    enum: ExportFormat,
    example: ExportFormat.CSV,
  })
  @IsEnum(ExportFormat)
  @IsNotEmpty()
  format: ExportFormat;

  @ApiPropertyOptional({
    description: 'Specific fields to include in export',
    isArray: true,
    example: ['submitterEmail', 'submittedAt', 'status', 'data'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @ApiPropertyOptional({
    description: 'Export filters',
    type: ExportFiltersDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExportFiltersDto)
  filters?: ExportFiltersDto;

  @ApiPropertyOptional({
    description: 'Include file attachments in export',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeFiles?: boolean = false;

  @ApiPropertyOptional({
    description: 'Custom filename for export',
    example: 'submissions-2025-01',
  })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    description: 'Compression type for large exports',
    enum: CompressionType,
    example: CompressionType.ZIP,
  })
  @IsOptional()
  @IsEnum(CompressionType)
  compression?: CompressionType = CompressionType.NONE;

  @ApiPropertyOptional({
    description: 'Maximum number of records to export (0 = no limit)',
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  maxRecords?: number = 0;

  @ApiPropertyOptional({
    description: 'Email address to send download link',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  emailTo?: string;

  @ApiPropertyOptional({
    description: 'Export template to use',
    type: ExportTemplateDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExportTemplateDto)
  template?: ExportTemplateDto;

  @ApiPropertyOptional({
    description: 'Schedule recurring export (cron expression)',
    example: '0 9 1 * *', // First day of every month at 9 AM
  })
  @IsOptional()
  @IsString()
  schedule?: string;

  @ApiPropertyOptional({
    description: 'Enable background processing for large exports',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  async?: boolean = false;
}

/**
 * Export job status response DTO
 */
export class ExportJobResponseDto {
  @ApiProperty({
    description: 'Export job ID',
    example: '507f1f77bcf86cd799439011',
  })
  jobId: string;

  @ApiProperty({
    description: 'Export status',
    enum: ['pending', 'processing', 'completed', 'failed'],
    example: 'processing',
  })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @ApiProperty({
    description: 'Export progress (0-100)',
    example: 45,
  })
  progress: number;

  @ApiPropertyOptional({
    description: 'Download URL (available when completed)',
    example: 'https://storage.arvaform.com/exports/export-12345.csv',
  })
  downloadUrl?: string;

  @ApiPropertyOptional({
    description: 'Export filename',
    example: 'submissions-2025-01-14.csv',
  })
  filename?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes',
    example: 1048576,
  })
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Total records exported',
    example: 1500,
  })
  totalRecords?: number;

  @ApiPropertyOptional({
    description: 'Download link expiration time',
    example: '2025-01-21T10:30:00Z',
  })
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Error message if export failed',
    example: 'Failed to process large dataset',
  })
  error?: string;

  @ApiProperty({
    description: 'Export creation timestamp',
    example: '2025-01-14T10:30:00Z',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: 'Export completion timestamp',
    example: '2025-01-14T10:35:00Z',
  })
  completedAt?: string;
}
