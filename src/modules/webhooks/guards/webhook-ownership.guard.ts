import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Webhook, WebhookDocument } from '../entities/webhook.entity';

/**
 * Webhook Ownership Guard
 * Ensures users can only access webhooks they own
 * Supports both webhook-specific and form-specific ownership checks
 */
@Injectable()
export class WebhookOwnershipGuard implements CanActivate {
  private readonly logger = new Logger(WebhookOwnershipGuard.name);

  constructor(
    @InjectModel(Webhook.name)
    private readonly webhookModel: Model<WebhookDocument>,
  ) {}

  /**
   * Determine if the current user can access the webhook
   * @param context - Execution context with request information
   * @returns Promise<boolean> - True if user has access, throws exception otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;

    // Extract user ID from authenticated user
    if (!user || !user.id) {
      this.logger.warn('Webhook access attempt without authenticated user');
      throw new ForbiddenException('Authentication required to access webhooks');
    }

    const userId = user.id;

    // Handle different webhook-related endpoints
    if (params.webhookId) {
      // Direct webhook access
      return this.checkWebhookOwnership(params.webhookId, userId);
    } else if (params.formId && request.route.path.includes('webhooks')) {
      // Form-specific webhook access - check form ownership
      return this.checkFormWebhookAccess(params.formId, userId);
    } else if (request.body?.webhookIds) {
      // Bulk operations - check all webhook IDs
      return this.checkBulkWebhookOwnership(request.body.webhookIds, userId);
    }

    // For general webhook endpoints without specific ID, allow access
    // The service layer will filter results by user ID
    return true;
  }

  /**
   * Check if user owns the specific webhook
   * @param webhookId - Webhook ID to check
   * @param userId - User ID to verify ownership
   * @returns Promise<boolean> - True if user owns the webhook
   */
  private async checkWebhookOwnership(webhookId: string, userId: string): Promise<boolean> {
    try {
      // Validate webhook ID format
      if (!Types.ObjectId.isValid(webhookId)) {
        this.logger.warn(`Invalid webhook ID format: ${webhookId}`);
        throw new NotFoundException('Webhook not found');
      }

      // Find the webhook and check ownership
      const webhook = await this.webhookModel.findById(webhookId).select('userId').lean().exec();

      if (!webhook) {
        this.logger.warn(`Webhook not found: ${webhookId}`);
        throw new NotFoundException('Webhook not found');
      }

      // Check if user owns the webhook
      const isOwner = webhook.userId.toString() === userId;

      if (!isOwner) {
        this.logger.warn(
          `Unauthorized webhook access attempt: User ${userId} trying to access webhook ${webhookId} owned by ${webhook.userId.toString()}`,
        );
        throw new ForbiddenException('You do not have permission to access this webhook');
      }

      this.logger.debug(`Webhook ownership verified: User ${userId} owns webhook ${webhookId}`);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Error checking webhook ownership for webhook ${webhookId} and user ${userId}:`,
        error.stack,
      );
      throw new ForbiddenException('Unable to verify webhook access permissions');
    }
  }

  /**
   * Check if user has access to create/manage webhooks for a specific form
   * This would typically check form ownership, but for now allows access
   * since webhook ownership is the primary security layer
   * @param formId - Form ID to check
   * @param userId - User ID to verify access
   * @returns Promise<boolean> - True if user has access
   */
  private async checkFormWebhookAccess(formId: string, userId: string): Promise<boolean> {
    try {
      await Promise.resolve();
      // Validate form ID format
      if (!Types.ObjectId.isValid(formId)) {
        this.logger.warn(`Invalid form ID format: ${formId}`);
        throw new NotFoundException('Form not found');
      }

      // For now, we'll allow access since the webhook service will validate
      // form ownership during webhook creation/update operations
      // In a more complex scenario, we might check form ownership here
      this.logger.debug(`Form webhook access granted for form ${formId} and user ${userId}`);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Error checking form webhook access for form ${formId} and user ${userId}:`,
        error.stack,
      );
      throw new ForbiddenException('Unable to verify form webhook access permissions');
    }
  }

  /**
   * Check if user owns all webhooks in a bulk operation
   * @param webhookIds - Array of webhook IDs to check
   * @param userId - User ID to verify ownership
   * @returns Promise<boolean> - True if user owns all webhooks
   */
  private async checkBulkWebhookOwnership(webhookIds: string[], userId: string): Promise<boolean> {
    try {
      if (!Array.isArray(webhookIds) || webhookIds.length === 0) {
        this.logger.warn('Invalid webhook IDs array for bulk operation');
        throw new ForbiddenException('Invalid webhook IDs provided');
      }

      // Validate all webhook ID formats
      const invalidIds = webhookIds.filter(id => !Types.ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        this.logger.warn(`Invalid webhook ID formats in bulk operation: ${invalidIds.join(', ')}`);
        throw new NotFoundException('One or more webhooks not found');
      }

      // Convert to ObjectIds for query
      const objectIds = webhookIds.map(id => new Types.ObjectId(id));

      // Find all webhooks and check ownership
      const webhooks = await this.webhookModel
        .find({ _id: { $in: objectIds } })
        .select('_id userId')
        .lean()
        .exec();

      // Check if all requested webhooks exist
      if (webhooks.length !== webhookIds.length) {
        const foundIds = webhooks.map(w => w._id.toString());
        const missingIds = webhookIds.filter(id => !foundIds.includes(id));
        this.logger.warn(`Missing webhooks in bulk operation: ${missingIds.join(', ')}`);
        throw new NotFoundException(`Webhooks not found: ${missingIds.join(', ')}`);
      }

      // Check if user owns all webhooks
      const unauthorizedWebhooks = webhooks.filter(webhook => webhook.userId.toString() !== userId);

      if (unauthorizedWebhooks.length > 0) {
        const unauthorizedIds = unauthorizedWebhooks.map(w => w._id.toString());
        this.logger.warn(
          `Unauthorized webhook access attempt: User ${userId} trying to access webhooks ${unauthorizedIds.join(', ')} owned by other users`,
        );
        throw new ForbiddenException(
          'You do not have permission to access some of the selected webhooks',
        );
      }

      this.logger.debug(
        `All webhooks in bulk operation verified: User ${userId} owns all webhooks`,
      );
      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Error checking bulk webhook ownership for webhooks ${webhookIds.join(', ')} and user ${userId}:`,
        error.stack,
      );
      throw new ForbiddenException('Unable to verify bulk webhook access permissions');
    }
  }
}
