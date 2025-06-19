import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateThemeDto } from './dto/create-theme.dto';
import { ThemeQueryDto } from './dto/theme-query.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { ThemesService } from './themes.service';

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@ApiTags('themes')
@Controller('themes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  /**
   * Create a new theme
   */
  @Post()
  @ApiOperation({ summary: 'Create a new theme' })
  @ApiResponse({ status: 201, description: 'Theme created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid theme data' })
  @ApiResponse({ status: 409, description: 'Theme name already exists' })
  async create(
    @Body(ValidationPipe) createThemeDto: CreateThemeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.themesService.create(createThemeDto, req.user.id);
  }

  /**
   * Get all themes for the current user
   */
  @Get()
  @ApiOperation({ summary: 'Get all themes for current user' })
  @ApiResponse({ status: 200, description: 'Themes retrieved successfully' })
  async findAll(@Query() query: ThemeQueryDto, @Request() req: AuthenticatedRequest) {
    return await this.themesService.findAll(req.user.id, query);
  }

  /**
   * Get public themes
   */
  @Get('public')
  @ApiOperation({ summary: 'Get public themes' })
  @ApiResponse({ status: 200, description: 'Public themes retrieved successfully' })
  async findPublic(@Query() query: ThemeQueryDto) {
    return await this.themesService.findPublic(query);
  }

  /**
   * Get a specific theme by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get theme by ID' })
  @ApiResponse({ status: 200, description: 'Theme retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Theme not found' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.themesService.findOne(id, req.user.id);
  }

  /**
   * Update a theme
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a theme' })
  @ApiResponse({ status: 200, description: 'Theme updated successfully' })
  @ApiResponse({ status: 404, description: 'Theme not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateThemeDto: UpdateThemeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return await this.themesService.update(id, updateThemeDto, req.user.id);
  }

  /**
   * Delete a theme
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a theme' })
  @ApiResponse({ status: 204, description: 'Theme deleted successfully' })
  @ApiResponse({ status: 404, description: 'Theme not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.themesService.remove(id, req.user.id);
  }

  /**
   * Duplicate a theme
   */
  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a theme' })
  @ApiResponse({ status: 201, description: 'Theme duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Theme not found' })
  async duplicate(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.themesService.duplicate(id, req.user.id);
  }

  /**
   * Set theme as default
   */
  @Put(':id/default')
  @ApiOperation({ summary: 'Set theme as default' })
  @ApiResponse({ status: 200, description: 'Default theme updated successfully' })
  @ApiResponse({ status: 404, description: 'Theme not found' })
  async setDefault(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.themesService.setDefault(id, req.user.id);
  }

  /**
   * Share theme publicly
   */
  @Put(':id/share')
  @ApiOperation({ summary: 'Share theme publicly' })
  @ApiResponse({ status: 200, description: 'Theme sharing updated successfully' })
  @ApiResponse({ status: 404, description: 'Theme not found' })
  async shareTheme(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return await this.themesService.shareTheme(id, req.user.id);
  }
}
