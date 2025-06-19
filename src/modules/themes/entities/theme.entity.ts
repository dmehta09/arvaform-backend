import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ThemeDocument = Theme & Document;

/**
 * Color tokens for theme configuration
 */
export interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  base: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
}

/**
 * Typography configuration for themes
 */
export interface TypographyTokens {
  fontFamily: {
    primary: string;
    secondary: string;
    mono: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
  };
}

/**
 * Spacing tokens for consistent layout
 */
export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
  '5xl': string;
  '6xl': string;
}

/**
 * Border radius tokens
 */
export interface BorderTokens {
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  width: {
    thin: string;
    base: string;
    thick: string;
  };
}

/**
 * Shadow tokens for depth
 */
export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

/**
 * Layout tokens for responsive design
 */
export interface LayoutTokens {
  maxWidth: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };
  spacing: {
    container: string;
    section: string;
    element: string;
  };
}

/**
 * Complete theme token set
 */
export interface ThemeTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  borders: BorderTokens;
  shadows: ShadowTokens;
  layout: LayoutTokens;
  customCSS?: string;
}

@Schema({ timestamps: true })
export class Theme {
  @Prop({ required: true, maxlength: 100 })
  name: string;

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ type: Object, required: true })
  tokens: ThemeTokens;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ default: 0 })
  version: number;

  @Prop()
  parentThemeId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ThemeSchema = SchemaFactory.createForClass(Theme);

// Add indexes for better query performance
ThemeSchema.index({ userId: 1, name: 1 }, { unique: true });
ThemeSchema.index({ isPublic: 1, usageCount: -1 });
ThemeSchema.index({ tags: 1 });
ThemeSchema.index({ isDefault: 1 });
