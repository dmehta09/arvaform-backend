import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';
import { OAuthController } from './oauth.controller';
import { GitHubStrategy } from './strategies/github.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // Import Users module to access UsersService
    UsersModule,

    // Configure Passport for JWT strategy
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Configure JWT module with dynamic configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m',
          issuer: 'ArvaForm',
          audience: 'ArvaForm-Users',
        },
      }),
      inject: [ConfigService],
    }),

    // Configure rate limiting for authentication endpoints
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: parseInt(configService.get<string>('AUTH_RATE_LIMIT_TTL') || '900'), // 15 minutes
            limit: parseInt(configService.get<string>('AUTH_RATE_LIMIT_MAX') || '10'), // 10 attempts
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],

  controllers: [AuthController, OAuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GitHubStrategy, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, PassportModule, JwtModule],
})
export class AuthModule {}
