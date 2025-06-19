import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateFormDto } from './dto/create-form.dto';
import { FormQueryDto } from './dto/form-query.dto';
import { FormResponseDto } from './dto/form-response.dto';
import { PaginatedFormsDto } from './dto/paginated-forms.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { FormsService } from './forms.service';
import { FormOwnershipGuard } from './guards/form-ownership.guard';

/**
 * Controller for form management endpoints
 * Handles HTTP requests for form CRUD operations
 */
@ApiTags('forms')
@ApiBearerAuth()
@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  /**
   * Create a new form
   */
  @Post()
  @ApiOperation({ summary: 'Create a new form' })
  @ApiResponse({
    status: 201,
    description: 'Form created successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createFormDto: CreateFormDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.create(createFormDto, userId);
  }

  /**
   * Get forms with advanced search, filtering, and pagination
   */
  @Get('search')
  @ApiOperation({
    summary: 'Get forms with advanced search, filtering, and pagination',
    description:
      'Retrieve forms with cursor-based pagination, text search, and filtering capabilities',
  })
  @ApiResponse({
    status: 200,
    description: 'Forms retrieved successfully with pagination metadata',
    type: PaginatedFormsDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findWithPagination(
    @Query() queryDto: FormQueryDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<PaginatedFormsDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.findWithPagination(userId, queryDto);
  }

  /**
   * Get all forms for the authenticated user
   */
  @Get()
  @ApiOperation({ summary: 'Get all forms for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Forms retrieved successfully',
    type: [FormResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() // TODO: Replace with proper request typing once auth is implemented
  // @Req() req: AuthenticatedRequest
  : Promise<FormResponseDto[]> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.findAll(userId);
  }

  /**
   * Get a specific form by ID
   */
  @Get(':id')
  @UseGuards(FormOwnershipGuard)
  @ApiOperation({ summary: 'Get a specific form by ID' })
  @ApiResponse({
    status: 200,
    description: 'Form retrieved successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  async findOne(
    @Param('id') id: string,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.findOne(id, userId);
  }

  /**
   * Update a form
   */
  @Patch(':id')
  @UseGuards(FormOwnershipGuard)
  @ApiOperation({ summary: 'Update a form' })
  @ApiResponse({
    status: 200,
    description: 'Form updated successfully',
    type: FormResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  async update(
    @Param('id') id: string,
    @Body() updateFormDto: UpdateFormDto,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<FormResponseDto> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.update(id, updateFormDto, userId);
  }

  /**
   * Delete a form (soft delete)
   */
  @Delete(':id')
  @UseGuards(FormOwnershipGuard)
  @ApiOperation({ summary: 'Delete a form' })
  @ApiResponse({
    status: 200,
    description: 'Form deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Form not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not form owner' })
  async remove(
    @Param('id') id: string,
    // TODO: Replace with proper request typing once auth is implemented
    // @Req() req: AuthenticatedRequest
  ): Promise<{ message: string }> {
    // TODO: Get user ID from authenticated request
    const userId = 'temp-user-id'; // req.user.id
    return this.formsService.remove(id, userId);
  }
}
