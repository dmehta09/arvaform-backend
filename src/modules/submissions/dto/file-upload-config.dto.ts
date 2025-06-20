import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for file upload configuration
 */
export class FileUploadConfigDto {
  @ApiProperty({
    description: 'Maximum file size in bytes',
    example: 10485760, // 10MB
  })
  maxFileSize: number;

  @ApiProperty({
    description: 'Maximum number of files per submission',
    example: 10,
  })
  maxFiles: number;

  @ApiProperty({
    description: 'Allowed MIME types',
    example: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    type: [String],
  })
  allowedMimeTypes: string[];

  @ApiProperty({
    description: 'Allowed file extensions',
    example: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx'],
    type: [String],
  })
  allowedExtensions: string[];
}
