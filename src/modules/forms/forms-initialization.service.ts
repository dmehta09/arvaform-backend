import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FormsRepository } from './forms.repository';

/**
 * Service for initializing forms module
 * Handles database setup and index creation
 */
@Injectable()
export class FormsInitializationService implements OnModuleInit {
  private readonly logger = new Logger(FormsInitializationService.name);

  constructor(private readonly formsRepository: FormsRepository) {}

  /**
   * Called once the module has been initialized
   * Sets up database indexes for optimal query performance
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing forms module...');

    try {
      // Create search indexes for better query performance
      await this.formsRepository.createSearchIndexes();
      this.logger.log('Forms module initialization completed successfully');
    } catch (error: unknown) {
      this.logger.error('Failed to initialize forms module:', error);
      // Don't throw error to prevent application startup failure
    }
  }
}
