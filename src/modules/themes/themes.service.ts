import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateThemeDto } from './dto/create-theme.dto';
import { ThemeQueryDto } from './dto/theme-query.dto';
import { PaginatedThemesResponse, ThemeFilter, ThemeSort } from './dto/theme-response.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { Theme, ThemeDocument } from './entities/theme.entity';

/**
 * Themes Service - ArvaForm 2025
 * Handles theme persistence, sharing, and management
 */
@Injectable()
export class ThemesService {
  constructor(@InjectModel(Theme.name) private themeModel: Model<ThemeDocument>) {}

  /**
   * Create a new theme
   */
  async create(createThemeDto: CreateThemeDto, userId: string): Promise<ThemeDocument> {
    // Check if theme name already exists for this user
    const existingTheme = await this.themeModel
      .findOne({
        userId,
        name: createThemeDto.name,
      })
      .exec();

    if (existingTheme) {
      throw new ConflictException('Theme name already exists');
    }

    const theme = new this.themeModel({
      ...createThemeDto,
      userId,
    });

    return await theme.save();
  }

  /**
   * Get all themes for current user
   */
  async findAll(userId: string, query: ThemeQueryDto): Promise<PaginatedThemesResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      isPublic,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const filter: ThemeFilter = { userId };

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (isPublic !== undefined) {
      filter.isPublic = isPublic;
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    const sortObj: ThemeSort = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [themes, total] = await Promise.all([
      this.themeModel.find(filter).sort(sortObj).skip(skip).limit(limit).exec(),
      this.themeModel.countDocuments(filter).exec(),
    ]);

    return {
      themes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get public themes
   */
  async findPublic(query: ThemeQueryDto): Promise<PaginatedThemesResponse> {
    const { page = 1, limit = 20, search, tags, sortBy = 'usageCount', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const filter: ThemeFilter = { isPublic: true };

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (tags && tags.length > 0) {
      filter.tags = { $in: tags };
    }

    const sortObj: ThemeSort = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [themes, total] = await Promise.all([
      this.themeModel.find(filter).sort(sortObj).skip(skip).limit(limit).exec(),
      this.themeModel.countDocuments(filter).exec(),
    ]);

    return {
      themes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get theme by ID
   */
  async findOne(themeId: string, userId: string): Promise<ThemeDocument> {
    const theme = await this.themeModel
      .findOne({
        _id: themeId,
        $or: [{ userId }, { isPublic: true }],
      })
      .exec();

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    return theme;
  }

  /**
   * Update theme
   */
  async update(
    themeId: string,
    updateThemeDto: UpdateThemeDto,
    userId: string,
  ): Promise<ThemeDocument> {
    const theme = await this.themeModel
      .findOneAndUpdate(
        {
          _id: themeId,
          userId,
        },
        updateThemeDto,
        { new: true },
      )
      .exec();

    if (!theme) {
      throw new NotFoundException('Theme not found or unauthorized');
    }

    return theme;
  }

  /**
   * Delete theme
   */
  async remove(themeId: string, userId: string): Promise<void> {
    const result = await this.themeModel
      .deleteOne({
        _id: themeId,
        userId,
      })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Theme not found or unauthorized');
    }
  }

  /**
   * Duplicate a theme
   */
  async duplicate(themeId: string, userId: string): Promise<ThemeDocument> {
    const originalTheme = await this.findOne(themeId, userId);

    const duplicatedTheme = new this.themeModel({
      name: `${originalTheme.name} (Copy)`,
      description: originalTheme.description,
      tokens: originalTheme.tokens,
      tags: originalTheme.tags,
      userId,
      isDefault: false,
      isPublic: false,
    });

    return await duplicatedTheme.save();
  }

  /**
   * Set theme as default
   */
  async setDefault(themeId: string, userId: string): Promise<ThemeDocument> {
    // First, unset all existing default themes for this user
    await this.themeModel.updateMany({ userId, isDefault: true }, { isDefault: false }).exec();

    // Then set the specified theme as default
    const theme = await this.themeModel
      .findOneAndUpdate({ _id: themeId, userId }, { isDefault: true }, { new: true })
      .exec();

    if (!theme) {
      throw new NotFoundException('Theme not found or unauthorized');
    }

    return theme;
  }

  /**
   * Share theme publicly
   */
  async shareTheme(themeId: string, userId: string): Promise<ThemeDocument> {
    const theme = await this.themeModel
      .findOneAndUpdate({ _id: themeId, userId }, { isPublic: true }, { new: true })
      .exec();

    if (!theme) {
      throw new NotFoundException('Theme not found or unauthorized');
    }

    // Increment usage count when shared
    theme.usageCount += 1;
    await theme.save();

    return theme;
  }
}
