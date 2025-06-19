import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Form, FormDocument } from '../entities/form.entity';

interface AuthenticatedUser {
  userId: string;
  email?: string;
  role?: string;
}

interface AuthenticatedRequest {
  params: { id: string };
  user?: AuthenticatedUser;
}

/**
 * Guard to check if user has access to a form
 * Validates form ownership or collaboration access
 */
@Injectable()
export class FormOwnershipGuard implements CanActivate {
  constructor(@InjectModel(Form.name) private formModel: Model<FormDocument>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const formId = request.params?.id;
    const userId = request.user?.userId;

    if (!formId) {
      throw new ForbiddenException('Form ID is required');
    }

    if (!userId) {
      throw new ForbiddenException('User authentication required');
    }

    try {
      const form = await this.formModel
        .findOne({
          _id: formId,
          deletedAt: { $exists: false },
        })
        .exec();

      if (!form) {
        throw new NotFoundException('Form not found');
      }

      // Check if user is the owner
      if (form.userId.toString() === userId) {
        return true;
      }

      // Check if user is a collaborator
      const isCollaborator = form.collaborators.some(
        collaborator => collaborator.userId.toString() === userId,
      );

      if (!isCollaborator) {
        throw new ForbiddenException('Access denied to this form');
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify form access');
    }
  }
}
