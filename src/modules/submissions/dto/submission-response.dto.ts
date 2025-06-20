import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Response DTO for submission file information
 */
export class SubmissionFileResponseDto {
  @ApiProperty({
    description: 'Field ID associated with the file',
    example: 'file-upload-1',
  })
  fieldId: string;

  @ApiProperty({
    description: 'Original filename as uploaded',
    example: 'document.pdf',
  })
  originalName: string;

  @ApiProperty({
    description: 'Stored filename on server',
    example: '1642780800000-document.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  mimetype: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  size: number;

  @ApiProperty({
    description: 'URL to access the file',
    example: 'https://storage.arvaform.com/files/1642780800000-document.pdf',
  })
  url: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-01-14T10:30:00Z',
  })
  uploadedAt: Date;

  @ApiPropertyOptional({
    description: 'Virus scan status',
    example: true,
  })
  virusScanned?: boolean;

  @ApiPropertyOptional({
    description: 'File checksum for integrity verification',
    example: 'sha256:abc123...',
  })
  checksum?: string;
}

/**
 * Response DTO for payment information
 */
export class SubmissionPaymentResponseDto {
  @ApiProperty({
    description: 'Payment status',
    enum: ['pending', 'completed', 'failed', 'refunded'],
    example: 'completed',
  })
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  @ApiProperty({
    description: 'Payment amount in smallest currency unit',
    example: 2500,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currency: string;

  @ApiPropertyOptional({
    description: 'Transaction ID from payment gateway',
    example: 'pi_1234567890abcdef',
  })
  transactionId?: string;

  @ApiProperty({
    description: 'Payment gateway used',
    example: 'stripe',
  })
  gateway: string;

  @ApiPropertyOptional({
    description: 'Payment completion timestamp',
    example: '2025-01-14T10:35:00Z',
  })
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'Gateway response data',
    example: { paymentMethod: 'card', last4: '4242' },
  })
  gatewayResponse?: Record<string, unknown>;
}

/**
 * Response DTO for submitter information
 */
export class SubmitterInfoResponseDto {
  @ApiPropertyOptional({
    description: 'User ID if submitter was authenticated',
    example: '507f1f77bcf86cd799439011',
  })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Email address of the submitter',
    example: 'user@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Name of the submitter',
    example: 'John Doe',
  })
  name?: string;

  @ApiProperty({
    description: 'IP address of the submitter',
    example: '192.168.1.100',
  })
  ipAddress: string;

  @ApiProperty({
    description: 'User agent string',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  userAgent: string;

  @ApiPropertyOptional({
    description: 'Geographic location information',
    example: {
      country: 'United States',
      city: 'New York',
      coordinates: [-74.006, 40.7128],
    },
  })
  location?: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
}

/**
 * Response DTO for processing status
 */
export class ProcessingStatusResponseDto {
  @ApiProperty({
    description: 'Notification processing status',
    example: {
      sent: true,
      sentAt: '2025-01-14T10:32:00Z',
    },
  })
  notifications: {
    sent: boolean;
    sentAt?: Date;
    error?: string;
  };

  @ApiProperty({
    description: 'Integration processing status',
    example: [
      {
        type: 'webhook',
        processed: true,
        processedAt: '2025-01-14T10:33:00Z',
      },
    ],
  })
  integrations: {
    type: string;
    processed: boolean;
    processedAt?: Date;
    error?: string;
  }[];
}

/**
 * Response DTO for digital signature
 */
export class DigitalSignatureResponseDto {
  @ApiProperty({
    description: 'Field ID for the signature',
    example: 'signature-field-1',
  })
  fieldId: string;

  @ApiProperty({
    description: 'Base64 encoded signature data',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...',
  })
  signatureData: string;

  @ApiProperty({
    description: 'Signature timestamp',
    example: '2025-01-14T10:31:00Z',
  })
  signedAt: Date;

  @ApiProperty({
    description: 'Signer information',
    example: {
      name: 'John Doe',
      email: 'john@example.com',
      ipAddress: '192.168.1.100',
    },
  })
  signerInfo: {
    name: string;
    email: string;
    ipAddress: string;
  };

  @ApiProperty({
    description: 'Audit trail for the signature',
    example: [
      {
        timestamp: '2025-01-14T10:31:00Z',
        action: 'signature_created',
        details: 'Digital signature applied to document',
      },
    ],
  })
  auditTrail: {
    timestamp: Date;
    action: string;
    details: string;
  }[];
}

/**
 * Main response DTO for form submission
 */
export class SubmissionResponseDto {
  @ApiProperty({
    description: 'Submission ID (auto-generated)',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  @ApiProperty({
    description: 'Form ID that this submission belongs to',
    example: '507f1f77bcf86cd799439012',
  })
  formId: string;

  @ApiProperty({
    description: 'Form version when submitted',
    example: 1,
  })
  formVersion: number;

  @ApiProperty({
    description: 'Human-readable submission ID',
    example: 'SUB-20250114-ABC12',
  })
  submissionId: string;

  @ApiProperty({
    description: 'Submission status',
    enum: ['draft', 'submitted', 'processed', 'archived'],
    example: 'submitted',
  })
  status: 'draft' | 'submitted' | 'processed' | 'archived';

  @ApiProperty({
    description: 'Submission source',
    enum: ['web', 'mobile', 'api', 'email', 'embed'],
    example: 'web',
  })
  source: 'web' | 'mobile' | 'api' | 'email' | 'embed';

  @ApiProperty({
    description: 'Form submission data',
    example: {
      'field-1': 'John Doe',
      'field-2': 'john@example.com',
      'field-3': ['option1', 'option2'],
    },
  })
  data: Record<string, unknown>;

  @ApiProperty({
    description: 'Uploaded files',
    type: [SubmissionFileResponseDto],
  })
  @Type(() => SubmissionFileResponseDto)
  files: SubmissionFileResponseDto[];

  @ApiPropertyOptional({
    description: 'Payment information',
    type: SubmissionPaymentResponseDto,
  })
  @Type(() => SubmissionPaymentResponseDto)
  payment?: SubmissionPaymentResponseDto;

  @ApiPropertyOptional({
    description: 'Submitter information',
    type: SubmitterInfoResponseDto,
  })
  @Type(() => SubmitterInfoResponseDto)
  submittedBy?: SubmitterInfoResponseDto;

  @ApiProperty({
    description: 'Processing status',
    type: ProcessingStatusResponseDto,
  })
  @Type(() => ProcessingStatusResponseDto)
  processing: ProcessingStatusResponseDto;

  @ApiPropertyOptional({
    description: 'Digital signatures',
    type: [DigitalSignatureResponseDto],
  })
  @Type(() => DigitalSignatureResponseDto)
  signatures?: DigitalSignatureResponseDto[];

  @ApiProperty({
    description: 'Submission timestamp',
    example: '2025-01-14T10:30:00Z',
  })
  submittedAt: Date;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2025-01-14T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2025-01-14T10:35:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Soft delete timestamp',
    example: null,
  })
  deletedAt?: Date;
}

/**
 * Response DTO for submission creation confirmation
 */
export class SubmissionCreatedResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Submission created successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Created submission data',
    type: SubmissionResponseDto,
  })
  @Type(() => SubmissionResponseDto)
  submission: SubmissionResponseDto;

  @ApiPropertyOptional({
    description: 'Redirect URL for thank you page',
    example: 'https://example.com/thank-you',
  })
  redirectUrl?: string;

  @ApiPropertyOptional({
    description: 'Custom thank you message',
    example: 'Thank you for your submission! We will get back to you soon.',
  })
  thankYouMessage?: string;
}
