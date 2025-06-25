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
      const dateFilter: FilterQuery<Date> = {};
      if (createdAfter) {
        dateFilter.$gte = new Date(createdAfter);
      }
      if (createdBefore) {
        dateFilter.$lte = new Date(createdBefore);
      }
      baseQuery.createdAt = dateFilter;
    }

    if (updatedAfter || updatedBefore) {
      const dateFilter: FilterQuery<Date> = {};
      if (updatedAfter) {
        dateFilter.$gte = new Date(updatedAfter);
      }
      if (updatedBefore) {
        dateFilter.$lte = new Date(updatedBefore);
      }
      baseQuery.updatedAt = dateFilter;
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
          ? (forms[forms.length - 1][this.getSortField(sortBy)] as Date).toISOString()
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
      this.logger.error(
        `Failed to fetch paginated forms for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async create(form_data: Omit<Form, 'save'>): Promise<FormResponseDto> {
    const createdForm = new this.formModel(form_data);
    const savedForm = await createdForm.save();
    return this.transformToResponseDto(savedForm);
  }

  async findAll(userId: string): Promise<FormResponseDto[]> {
    const forms = await this.formModel
      .find({
        userId,
        deletedAt: { $exists: false },
      })
      .sort({ updatedAt: -1 })
      .exec();
    return forms.map(form => this.transformToResponseDto(form));
  }

  async findById(id: string): Promise<FormDocument | null> {
    return this.formModel.findById(id).exec();
  }

  async findOne(conditions: FilterQuery<FormDocument>): Promise<FormDocument | null> {
    return this.formModel.findOne(conditions).exec();
  }

  async update(id: string, updateData: Partial<Form>): Promise<FormDocument | null> {
    return this.formModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async remove(id: string, userId: string): Promise<FormDocument | null> {
    return this.formModel
      .findByIdAndUpdate(id, { deletedAt: new Date(), deletedBy: userId }, { new: true })
      .exec();
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
      this.logger.error(
        'Failed to create search indexes:',
        error instanceof Error ? error.message : String(error),
      );
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
    interface TransformResult {
      _id: string;
      userId?: string;
      organizationId?: string;
      collaborators?: Array<{ userId: string; role: string; addedAt: Date; expiresAt?: Date }>;
      settings?: {
        theme?: {
          themeId?: string;
        };
      };
      deletedBy?: string;
      [key: string]: unknown;
    }

    const formObject = form.toObject({
      transform: (doc: unknown, ret: TransformResult): TransformResult => {
        // Convert ObjectId fields to strings
        ret._id = String(ret._id);
        if (ret.userId) ret.userId = String(ret.userId);
        if (ret.organizationId) ret.organizationId = String(ret.organizationId);
        if (ret.collaborators && Array.isArray(ret.collaborators)) {
          ret.collaborators = ret.collaborators.map(
            (c: { userId: unknown; role: string; addedAt: Date; expiresAt?: Date }) => ({
              ...c,
              userId: String(c.userId),
            }),
          );
        }
        if (ret.settings?.theme?.themeId) {
          ret.settings.theme.themeId = String(ret.settings.theme.themeId);
        }
        if (ret.deletedBy) ret.deletedBy = String(ret.deletedBy);
        return ret;
      },
    }) as FormResponseDto;

    return formObject;
  }
}
