import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/**
 * DTO for submitter information
 */
export class SubmitterInfoDto {
  @ApiPropertyOptional({
    description: 'User ID if submitter is authenticated',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Email address of the submitter',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Name of the submitter',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Location information (automatically detected)',
    example: {
      country: 'United States',
      city: 'New York',
      coordinates: [-74.006, 40.7128],
    },
  })
  @IsOptional()
  @IsObject()
  location?: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
}

export class SignerInfoDto {
  @ApiProperty({
    description: 'Full name of the signer',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Email address of the signer',
    example: 'john@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'IP address of the signer (auto-detected)',
    example: '192.168.1.1',
  })
  @IsString()
  @IsNotEmpty()
  ipAddress: string;
}

/**
 * DTO for digital signature submission
 */
export class DigitalSignatureDto {
  @ApiProperty({
    description: 'Field ID for the signature element',
    example: 'signature-field-1',
  })
  @IsString()
  @IsNotEmpty()
  fieldId: string;

  @ApiProperty({
    description: 'Base64 encoded signature data',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...',
  })
  @IsString()
  @IsNotEmpty()
  signatureData: string;

  @ApiProperty({
    description: 'Signer information',
    example: {
      name: 'John Doe',
      email: 'john@example.com',
      ipAddress: '192.168.1.1',
    },
  })
  @ValidateNested()
  @Type(() => SignerInfoDto)
  signerInfo: SignerInfoDto;
}

/**
 * DTO for payment information submission
 */
export class PaymentSubmissionDto {
  @ApiProperty({
    description: 'Payment gateway used',
    example: 'stripe',
  })
  @IsString()
  @IsNotEmpty()
  gateway: string;

  @ApiProperty({
    description: 'Payment amount in smallest currency unit (e.g., cents)',
    example: 2500,
  })
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(String(value), 10))
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({
    description: 'Transaction ID from payment gateway',
    example: 'pi_1234567890abcdef',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Gateway response data',
    example: { paymentMethod: 'card', last4: '4242' },
  })
  @IsOptional()
  @IsObject()
  gatewayResponse?: Record<string, unknown>;
}

/**
 * Main DTO for creating a form submission
 */
export class CreateSubmissionDto {
  @ApiProperty({
    description: 'Form submission data as key-value pairs',
    example: {
      'field-1': 'John Doe',
      'field-2': 'john@example.com',
      'field-3': ['option1', 'option2'],
    },
  })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Submission source',
    enum: ['web', 'mobile', 'api', 'email', 'embed'],
    example: 'web',
  })
  @IsOptional()
  @IsEnum(['web', 'mobile', 'api', 'email', 'embed'])
  source?: 'web' | 'mobile' | 'api' | 'email' | 'embed';

  @ApiPropertyOptional({
    description: 'Submitter information',
    type: SubmitterInfoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SubmitterInfoDto)
  submittedBy?: SubmitterInfoDto;

  @ApiPropertyOptional({
    description: 'Digital signatures for signature fields',
    type: [DigitalSignatureDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DigitalSignatureDto)
  signatures?: DigitalSignatureDto[];

  @ApiPropertyOptional({
    description: 'Payment information for forms with payment',
    type: PaymentSubmissionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentSubmissionDto)
  payment?: PaymentSubmissionDto;

  @ApiPropertyOptional({
    description: 'Draft submission flag - if true, submission is saved as draft',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }: { value: boolean | string }) => {
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  isDraft?: boolean;

  @ApiPropertyOptional({
    description: 'reCAPTCHA token for spam protection',
    example: '03AGdBq25...',
  })
  @ValidateIf(obj => !obj.isDraft) // Only require CAPTCHA for final submissions
  @IsString()
  @IsNotEmpty({ message: 'CAPTCHA verification is required' })
  captchaToken?: string;

  @ApiPropertyOptional({
    description: 'Referrer URL where the form was submitted from',
    example: 'https://example.com/contact',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid referrer URL' })
  referrerUrl?: string;

  @ApiPropertyOptional({
    description: 'UTM parameters for tracking',
    example: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'contact_form',
    },
  })
  @IsOptional()
  @IsObject()
  utmParams?: Record<string, string>;
}
