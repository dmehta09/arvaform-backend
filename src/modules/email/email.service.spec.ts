/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailConfig } from '../../config/email.config';
import { EmailService } from './email.service';
import { EmailSendResult } from './interfaces/email-provider.interface';
import { AwsSesProvider } from './providers/aws-ses.provider';
import { SendGridProvider } from './providers/sendgrid.provider';

describe('EmailService', () => {
  let service: EmailService;
  let mockSendGridProvider: jest.Mocked<SendGridProvider>;
  let mockAwsSesProvider: jest.Mocked<AwsSesProvider>;

  const mockEmailSendResult: EmailSendResult = {
    success: true,
    messageId: 'test-message-id',
    providerId: 'sendgrid',
    timestamp: new Date(),
  };

  const mockEmailConfig: EmailConfig = {
    defaultFromEmail: 'test@arvaform.com',
    defaultFromName: 'ArvaForm Test',
    primaryProvider: 'sendgrid',
    sendgridApiKey: 'test-sendgrid-key',
    sendgridEnabled: true,
    awsAccessKeyId: 'test-aws-key',
    awsSecretAccessKey: 'test-aws-secret',
    awsRegion: 'us-east-1',
    awsSesEnabled: true,
    rateLimit: {
      maxEmailsPerSecond: 5,
      maxEmailsPerMinute: 100,
      maxEmailsPerHour: 1000,
      maxEmailsPerDay: 10000,
    },
    retry: {
      maxRetries: 3,
      initialRetryDelayMs: 1000,
      useExponentialBackoff: true,
      maxRetryDelayMs: 30000,
    },
    healthCheckIntervalMs: 300000,
    healthCheckTimeoutMs: 10000,
    enableDetailedLogging: false,
    enableMetrics: true,
  };

  beforeEach(async () => {
    // Create mock implementations
    mockSendGridProvider = {
      sendEmail: jest.fn().mockResolvedValue(mockEmailSendResult),
      sendTemplateEmail: jest.fn().mockResolvedValue(mockEmailSendResult),
      sendBulkEmails: jest.fn(),
      verifyConfiguration: jest.fn(),
      getProviderStats: jest.fn(),
    } as unknown as jest.Mocked<SendGridProvider>;

    mockAwsSesProvider = {
      sendEmail: jest.fn().mockResolvedValue(mockEmailSendResult),
      sendTemplateEmail: jest.fn().mockResolvedValue(mockEmailSendResult),
      sendBulkEmails: jest.fn(),
      verifyConfiguration: jest.fn(),
      getProviderStats: jest.fn(),
    } as unknown as jest.Mocked<AwsSesProvider>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EmailConfig,
          useValue: mockEmailConfig,
        },
        {
          provide: SendGridProvider,
          useValue: mockSendGridProvider,
        },
        {
          provide: AwsSesProvider,
          useValue: mockAwsSesProvider,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    // Suppress logs during testing
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize successfully', async () => {
      mockSendGridProvider.verifyConfiguration.mockResolvedValue({
        isHealthy: true,
        providerId: 'sendgrid',
        timestamp: new Date(),
        responseTime: 100,
      });

      mockAwsSesProvider.verifyConfiguration.mockResolvedValue({
        isHealthy: true,
        providerId: 'aws-ses',
        timestamp: new Date(),
        responseTime: 150,
      });

      await service.onModuleInit();

      expect(mockSendGridProvider.verifyConfiguration).toHaveBeenCalled();
      expect(mockAwsSesProvider.verifyConfiguration).toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should send email using primary provider', async () => {
      const result = await service.sendEmail(
        'recipient@example.com',
        'Test Subject',
        '<h1>Test Content</h1>',
        'sender@arvaform.com',
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSendGridProvider.sendEmail).toHaveBeenCalledWith(
        'recipient@example.com',
        'Test Subject',
        '<h1>Test Content</h1>',
        'sender@arvaform.com',
      );
    });

    it('should return error result when primary provider fails', async () => {
      const failureResult = {
        success: false,
        providerId: 'sendgrid',
        timestamp: new Date(),
        error: 'Primary provider failed',
      };

      mockSendGridProvider.sendEmail.mockResolvedValue(failureResult);
      mockAwsSesProvider.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'aws-message-id',
        providerId: 'aws-ses',
        timestamp: new Date(),
      });

      const result = await service.sendEmail(
        'recipient@example.com',
        'Test Subject',
        '<h1>Test Content</h1>',
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('aws-message-id');
      expect(mockSendGridProvider.sendEmail).toHaveBeenCalled();
      expect(mockAwsSesProvider.sendEmail).toHaveBeenCalled();
    });
  });

  describe('getProvidersHealth', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return health status for all providers', async () => {
      const sendGridHealth = {
        isHealthy: true,
        providerId: 'sendgrid',
        timestamp: new Date(),
        responseTime: 100,
      };

      const awsHealth = {
        isHealthy: true,
        providerId: 'aws-ses',
        timestamp: new Date(),
        responseTime: 150,
      };

      mockSendGridProvider.verifyConfiguration.mockResolvedValue(sendGridHealth);
      mockAwsSesProvider.verifyConfiguration.mockResolvedValue(awsHealth);

      const healthChecks = await service.getProvidersHealth();

      expect(healthChecks).toHaveLength(2);
      expect(healthChecks[0]).toEqual(sendGridHealth);
      expect(healthChecks[1]).toEqual(awsHealth);
    });
  });

  describe('getProvidersStats', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should return statistics for all providers', async () => {
      const sendGridStats = {
        providerId: 'sendgrid',
        dailyEmailsSent: 100,
        monthlyEmailsSent: 2500,
        deliveryRate: 0.98,
        bounceRate: 0.01,
        complaintRate: 0.001,
        lastUpdated: new Date(),
      };

      const awsStats = {
        providerId: 'aws-ses',
        dailyEmailsSent: 50,
        monthlyEmailsSent: 1200,
        deliveryRate: 0.99,
        bounceRate: 0.005,
        complaintRate: 0.001,
        lastUpdated: new Date(),
      };

      mockSendGridProvider.getProviderStats.mockResolvedValue(sendGridStats);
      mockAwsSesProvider.getProviderStats.mockResolvedValue(awsStats);

      const stats = await service.getProvidersStats();

      expect(stats).toHaveLength(2);
      expect(stats[0]).toEqual(sendGridStats);
      expect(stats[1]).toEqual(awsStats);
    });
  });
});
