import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ThemeTokens } from '../entities/theme.entity';

export class CreateThemeDto {
  @ApiProperty({
    description: 'Theme name',
    example: 'My Custom Theme',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Theme description',
    example: 'A beautiful theme for my brand',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Theme tokens configuration',
  })
  @IsObject()
  tokens: ThemeTokens;

  @ApiPropertyOptional({
    description: 'Whether this should be the default theme',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this theme should be public',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Tags for categorizing the theme',
    type: [String],
    example: ['modern', 'minimal', 'dark'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
