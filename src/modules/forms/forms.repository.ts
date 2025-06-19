import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { FormQueryDto, SortBy, SortOrder } from './dto/form-query.dto';
import { FormResponseDto } from './dto/form-response.dto';
import { PaginatedFormsDto } from './dto/paginated-forms.dto';
import { Form, FormDocument } from './entities/form.entity';

/**
 * Repository for form-related database operations
 * Handles complex queries, pagination, and search functionality
 */
@Injectable()
export class FormsRepository {
  private readonly logger = new Logger(FormsRepository.name);

  constructor(@InjectModel(Form.name) private formModel: Model<FormDocument>) {}

  /**
   * Find forms with advanced querying, pagination and search
   * Uses cursor-based pagination for optimal performance with large datasets
   * @param userId - ID of the user
   * @param queryDto - Query parameters for filtering, sorting, and pagination
   * @returns Paginated forms response with metadata
   */
  async findWithPagination(userId: string, queryDto: FormQueryDto): Promise<PaginatedFormsDto> {
    this.logger.log(`Finding paginated forms for user: ${userId}`);

    const {
      search,
      cursor,
      limit = 10,
      status,
      sortBy = SortBy.UPDATED_AT,
      sortOrder = SortOrder.DESC,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
    } = queryDto;

    // Build base filter query
    const baseQuery: FilterQuery<FormDocument> = {
      userId,
      deletedAt: { $exists: false },
    };

    // Add search filter using MongoDB text search
    if (search) {
      baseQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { $text: { $search: search } },
      ];
    }

    // Add status filter
    if (status) {
      baseQuery.status = status;
    }

    // Add date range filters
    if (createdAfter || createdBefore) {
      baseQuery.createdAt = {};
      if (createdAfter) {
        baseQuery.createdAt.$gte = new Date(createdAfter);
      }
      if (createdBefore) {
        baseQuery.createdAt.$lte = new Date(createdBefore);
      }
    }

    if (updatedAfter || updatedBefore) {
      baseQuery.updatedAt = {};
      if (updatedAfter) {
        baseQuery.updatedAt.$gte = new Date(updatedAfter);
      }
      if (updatedBefore) {
        baseQuery.updatedAt.$lte = new Date(updatedBefore);
      }
    }

    // Cursor-based pagination
    if (cursor) {
      const cursorDate = new Date(cursor);
      const sortField = this.getSortField(sortBy);

      if (sortOrder === SortOrder.DESC) {
        baseQuery[sortField] = { $lt: cursorDate };
      } else {
        baseQuery[sortField] = { $gt: cursorDate };
      }
    }

    try {
      // Get total count for metadata (separate query for performance)
      const totalCount = await this.formModel.countDocuments({
        userId,
        deletedAt: { $exists: false },
        ...(search && {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { $text: { $search: search } },
          ],
        }),
        ...(status && { status }),
        ...((createdAfter || createdBefore) && {
          createdAt: {
            ...(createdAfter && { $gte: new Date(createdAfter) }),
            ...(createdBefore && { $lte: new Date(createdBefore) }),
          },
        }),
        ...((updatedAfter || updatedBefore) && {
          updatedAt: {
            ...(updatedAfter && { $gte: new Date(updatedAfter) }),
            ...(updatedBefore && { $lte: new Date(updatedBefore) }),
          },
        }),
      });

      // Fetch one extra record to determine if there's a next page
      const forms = await this.formModel
        .find(baseQuery)
        .sort(this.buildSortOptions(sortBy, sortOrder))
        .limit(limit + 1)
        .exec();

      // Check if there are more records
      const hasNextPage = forms.length > limit;

      // Remove the extra record if it exists
      if (hasNextPage) {
        forms.pop();
      }

      // Determine next cursor
      const nextCursor =
        hasNextPage && forms.length > 0
          ? forms[forms.length - 1][this.getSortField(sortBy)].toISOString()
          : null;

      this.logger.log(
        `Found ${forms.length} forms for user: ${userId}, hasNextPage: ${hasNextPage}`,
      );

      return {
        data: forms.map(form => this.transformToResponseDto(form)),
        pagination: {
          hasNextPage,
          nextCursor,
          totalCount,
          limit,
        },
        filters: {
          search,
          status,
          sortBy,
          sortOrder,
          createdAfter,
          createdBefore,
          updatedAfter,
          updatedBefore,
        },
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch paginated forms for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create text index for search functionality
   * Should be called during application startup
   */
  async createSearchIndexes(): Promise<void> {
    try {
      await this.formModel.collection.createIndex({
        title: 'text',
        description: 'text',
      });

      // Create additional indexes for common query patterns
      await this.formModel.collection.createIndex({ userId: 1, status: 1 });
      await this.formModel.collection.createIndex({ userId: 1, updatedAt: -1 });
      await this.formModel.collection.createIndex({ userId: 1, createdAt: -1 });
      await this.formModel.collection.createIndex({ userId: 1, deletedAt: 1 });

      this.logger.log('Search indexes created successfully');
    } catch (error: unknown) {
      this.logger.error('Failed to create search indexes:', error);
      // Don't throw error to prevent application startup failure
    }
  }

  /**
   * Build sort options for MongoDB query
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort order (asc/desc)
   * @returns Sort options object
   */
  private buildSortOptions(sortBy: SortBy, sortOrder: SortOrder): Record<string, 1 | -1> {
    const sortField = this.getSortField(sortBy);
    const sortDirection = sortOrder === SortOrder.ASC ? 1 : -1;

    return { [sortField]: sortDirection };
  }

  /**
   * Get the actual database field name for sorting
   * @param sortBy - Sort by enum value
   * @returns Database field name
   */
  private getSortField(sortBy: SortBy): string {
    switch (sortBy) {
      case SortBy.CREATED_AT:
        return 'createdAt';
      case SortBy.UPDATED_AT:
        return 'updatedAt';
      case SortBy.TITLE:
        return 'title';
      case SortBy.SUBMISSIONS:
        return 'analytics.submissions';
      default:
        return 'updatedAt';
    }
  }

  /**
   * Transform form document to response DTO
   * @param form - Form document from MongoDB
   * @returns Form response DTO
   */
  private transformToResponseDto(form: FormDocument): FormResponseDto {
    const formObject = form.toObject
      ? form.toObject()
      : (form as unknown as Record<string, unknown>);

    return {
      _id: String(form._id),
      title: form.title,
      description: form.description,
      slug: form.slug,
      status: form.status,
      userId: form.userId.toString(),
      organizationId: form.organizationId?.toString(),
      collaborators: form.collaborators.map(collab => ({
        userId: collab.userId.toString(),
        role: collab.role,
        addedAt: collab.addedAt,
        expiresAt: collab.expiresAt,
      })),
      settings: {
        encryption: form.settings.encryption,
        layout: form.settings.layout,
        theme: form.settings.theme
          ? {
              themeId: form.settings.theme.themeId?.toString(),
              customStyles: form.settings.theme.customStyles
                ? {
                    css: form.settings.theme.customStyles.css,
                    variables: Object.fromEntries(
                      form.settings.theme.customStyles.variables || new Map(),
                    ),
                  }
                : undefined,
            }
          : undefined,
        branding: form.settings.branding,
      },
      elements: form.elements.map(element => ({
        id: element.id,
        type: element.type,
        label: element.label,
        placeholder: element.placeholder,
        helpText: element.helpText,
        required: element.required,
        validation: element.validation as Record<string, unknown> | undefined,
        properties: element.properties as Record<string, unknown> | undefined,
        styles: element.styles as Record<string, unknown> | undefined,
        options: element.options,
        order: element.order,
        parentId: element.parentId,
        createdAt: element.createdAt,
        updatedAt: element.updatedAt,
      })),
      pages: form.pages,
      conditions: form.conditions,
      postSubmission: form.postSubmission,
      integrations: form.integrations.map(integration => ({
        type: integration.type,
        config: integration.config as unknown as Record<string, unknown>,
        isActive: integration.isActive,
      })),
      publishing: form.publishing,
      analytics: form.analytics,
      createdAt: (formObject.createdAt as Date) || new Date(),
      updatedAt: (formObject.updatedAt as Date) || new Date(),
      deletedAt: form.deletedAt,
      deletedBy: form.deletedBy?.toString(),
    };
  }
}
