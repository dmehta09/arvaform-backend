import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { FileUploadConfigDto } from './dto/file-upload-config.dto';
import { PaginatedSubmissionsResponseDto } from './dto/paginated-submissions-response.dto';
import { SubmissionQueryDto } from './dto/submission-query.dto';
import { SubmissionCreatedResponseDto, SubmissionResponseDto } from './dto/submission-response.dto';
import { FileUploadService } from './services/file-upload.service';
import { SubmissionsService } from './submissions.service';

/**
 * Generic API response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

/**
 * Submissions Controller
 * Handles HTTP requests for form submission operations
 * Includes public submission endpoints and protected management endpoints
 */
@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(
    private readonly submissionsService: SubmissionsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * Submit a form with optional file uploads
   */
  @Post('forms/:formId')
  @RateLimit({ limit: 10, ttl: 60 }) // 10 submissions per minute
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit form data',
    description:
      'Submit form data with optional file uploads. Files are validated and processed securely.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'formId',
    description: 'Form ID to submit data to',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 201,
    description: 'Form submitted successfully',
    type: SubmissionCreatedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or form not found',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async createSubmission(
    @Param('formId') formId: string,
    @Body() createSubmissionDto: CreateSubmissionDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Req() req: Request,
  ): Promise<ApiResponse<SubmissionResponseDto>> {
    // Extract IP address and user agent for audit trail
    const submissionData = {
      ...createSubmissionDto,
      submittedBy: {
        ...createSubmissionDto.submittedBy,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('user-agent') || 'unknown',
        timestamp: new Date(),
      },
    };

    const submission = await this.submissionsService.createSubmission(
      formId,
      submissionData,
      files || [],
    );

    return {
      success: true,
      data: submission,
      message: 'Form submitted successfully',
    };
  }

  /**
   * Get submissions for a specific form (authenticated users only)
   */
  @Get('forms/:formId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get form submissions',
    description:
      'Retrieve paginated list of submissions for a specific form. Requires authentication.',
  })
  @ApiParam({
    name: 'formId',
    description: 'Form ID to retrieve submissions for',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Form submissions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            submissions: {
              type: 'array',
              items: { $ref: '#/components/schemas/SubmissionResponseDto' },
            },
            total: { type: 'number', example: 50 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 3 },
          },
        },
        message: { type: 'string', example: 'Form submissions retrieved successfully' },
      },
    },
  })
  async getFormSubmissions(
    @Param('formId') formId: string,
    @Query() query: SubmissionQueryDto,
  ): Promise<ApiResponse<PaginatedSubmissionsResponseDto>> {
    const result = await this.submissionsService.findSubmissionsByForm(formId, query);

    return {
      success: true,
      data: result,
      message: 'Form submissions retrieved successfully',
    };
  }

  /**
   * Get a specific submission by ID
   */
  @Get(':submissionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get submission by ID',
    description:
      'Retrieve detailed information about a specific submission. Requires authentication.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'Submission ID to retrieve',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Submission retrieved successfully',
    type: SubmissionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Submission not found',
  })
  async getSubmission(
    @Param('submissionId') submissionId: string,
  ): Promise<ApiResponse<SubmissionResponseDto>> {
    const submission = await this.submissionsService.findSubmissionById(submissionId);

    return {
      success: true,
      data: submission,
      message: 'Submission retrieved successfully',
    };
  }

  /**
   * Delete a submission
   */
  @Delete(':submissionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete submission',
    description: 'Delete a specific submission and its associated files. Requires authentication.',
  })
  @ApiParam({
    name: 'submissionId',
    description: 'Submission ID to delete',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'Submission deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Submission not found',
  })
  async deleteSubmission(
    @Param('submissionId') submissionId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.submissionsService.deleteSubmission(submissionId);

    return {
      success: true,
      data: {
        message: 'Submission deleted successfully',
      },
      message: 'Submission deleted successfully',
    };
  }

  /**
   * Get file upload configuration
   */
  @Get('upload/config')
  @Public()
  @ApiOperation({
    summary: 'Get file upload configuration',
    description: 'Get file upload limits and allowed file types for client-side validation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Upload configuration retrieved successfully',
    type: FileUploadConfigDto,
  })
  getUploadConfig(): ApiResponse<FileUploadConfigDto> {
    const config = this.fileUploadService.getUploadConfig();

    return {
      success: true,
      message: 'Upload configuration retrieved successfully',
      data: config,
    };
  }
}
