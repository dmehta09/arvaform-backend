import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';

/**
 * Bootstrap function to initialize and start the NestJS application
 * Configures security, validation, documentation, and CORS settings
 */
async function bootstrap(): Promise<void> {
  // Create NestJS application instance
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get configuration service for environment variables
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Get configuration values with defaults
  const port = configService.get<number>('PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  const corsOrigins = configService.get<string>(
    'CORS_ORIGINS',
    'http://localhost:3000',
  );

  // Set global API prefix
  app.setGlobalPrefix(apiPrefix);
  logger.debug(`API prefix set to: /${apiPrefix}`);

  // Security middleware - Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  logger.debug('Security middleware (Helmet) configured');

  // Global validation pipe with comprehensive options
  app.useGlobalPipes(
    new ValidationPipe({
      // Transform incoming data to match DTO types
      transform: true,
      // Automatically transform primitive types
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Strip properties that are not in the DTO
      whitelist: true,
      // Throw error if non-whitelisted properties are present
      forbidNonWhitelisted: true,
      // Return detailed error messages
      disableErrorMessages: nodeEnv === 'production',
      // Validate each item in an array
      validateCustomDecorators: true,
    }),
  );
  logger.debug('Global validation pipe configured');

  // CORS configuration for frontend integration
  const origins = corsOrigins.split(',').map((origin) => origin.trim());
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
    ],
    credentials: true,
    optionsSuccessStatus: 200,
  });
  logger.debug(`CORS enabled for origins: ${origins.join(', ')}`);

  // Swagger API documentation setup (only in development)
  if (nodeEnv === 'development') {
    const config = new DocumentBuilder()
      .setTitle('ArvaForm API')
      .setDescription('ArvaForm Platform - Comprehensive Form Management API')
      .setVersion('1.0.0')
      .addTag('health', 'Health check endpoints')
      .addTag('forms', 'Form management endpoints')
      .addTag('users', 'User management endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addServer(`http://localhost:${port}`, 'Development server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customSiteTitle: 'ArvaForm API Documentation',
    });

    logger.log(
      `Swagger documentation available at: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }

  // Start the application
  await app.listen(port);

  // Log startup information
  logger.log(`🚀 ArvaForm Backend started successfully!`);
  logger.log(`🌍 Environment: ${nodeEnv}`);
  logger.log(`🔗 Server running on: http://localhost:${port}`);
  logger.log(`📋 API endpoints: http://localhost:${port}/${apiPrefix}`);
  logger.log(`❤️  Health check: http://localhost:${port}/${apiPrefix}/health`);

  if (nodeEnv === 'development') {
    logger.log(
      `📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`,
    );
  }
}

// Start the application and handle errors
bootstrap().catch((error: Error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Failed to start application:', error.message);
  logger.error(error.stack);
  process.exit(1);
});
