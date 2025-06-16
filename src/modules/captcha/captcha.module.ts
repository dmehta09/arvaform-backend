import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CaptchaController } from './captcha.controller';
import { CaptchaService } from './captcha.service';

/**
 * CAPTCHA Module for Google reCAPTCHA v3 integration
 *
 * Provides CAPTCHA verification services to protect against bots and spam.
 * Uses Google reCAPTCHA v3 for invisible protection with risk scoring.
 */
@Module({
  imports: [ConfigModule],
  controllers: [CaptchaController],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
