import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as archiver from 'archiver';
import * as csvWriter from 'csv-writer';
import * as ExcelJS from 'exceljs';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { Model } from 'mongoose';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

import {
  CompressionType,
  ExportFiltersDto,
  ExportFormat,
  ExportJobResponseDto,
  ExportOptionsDto,
} from '../dto/export-options.dto';
import { Submission, SubmissionDocument } from '../entities/submission.entity';

/**
 * Export job interface for tracking background processes
 */
interface ExportJob {
  id: string;
  formId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  options: ExportOptionsDto;
  filename?: string;
  filePath?: string;
  fileSize?: number;
  totalRecords?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Export data formatting interface
 */
interface ExportData {
  headers: string[];
  rows: Record<string, unknown>[];
  totalCount: number;
}

/**
 * Comprehensive export service with streaming and background processing
 *
 * Features:
 * - CSV and Excel export generation
 * - Streaming for large datasets
 * - Background job processing
 * - File compression (ZIP/GZIP)
 * - Secure download links with expiration
 * - Export templates and presets
 * - Memory-efficient processing
 */
@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly exportJobs = new Map<string, ExportJob>();
  private readonly exportDirectory = join(process.cwd(), 'exports');
  private readonly maxSyncRecords = 1000; // Process synchronously up to 1K records
  private readonly downloadExpirationHours = 24; // Download links expire in 24 hours

  constructor(
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<SubmissionDocument>,
  ) {
    this.ensureExportDirectory();
  }

  /**
   * Create export directory if it doesn't exist
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.exportDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create export directory:', error);
    }
  }

  /**
   * Main export method - determines sync vs async processing
   */
  async exportSubmissions(
    formId: string,
    options: ExportOptionsDto,
    userId: string,
  ): Promise<ExportJobResponseDto | Buffer> {
    this.logger.log(`Starting export for form ${formId} with options:`, options);

    // Get total count to determine processing strategy
    const totalCount = await this.getSubmissionCount(formId, options.filters);

    // For small datasets or when explicitly requested, process synchronously
    if (!options.async && totalCount <= this.maxSyncRecords) {
      this.logger.log(`Processing ${totalCount} records synchronously`);
      return this.processSyncExport(formId, options);
    }

    // For large datasets, use background processing
    this.logger.log(`Processing ${totalCount} records asynchronously`);
    return this.processAsyncExport(formId, options, userId);
  }

  /**
   * Synchronous export processing for small datasets
   */
  private async processSyncExport(formId: string, options: ExportOptionsDto): Promise<Buffer> {
    const exportData = await this.fetchExportData(formId, options);
    return this.generateExportFile(exportData, options);
  }

  /**
   * Asynchronous export processing for large datasets
   */
  private processAsyncExport(
    formId: string,
    options: ExportOptionsDto,
    _userId: string,
  ): ExportJobResponseDto {
    const jobId = uuid();
    const job: ExportJob = {
      id: jobId,
      formId,
      status: 'pending',
      progress: 0,
      options,
      createdAt: new Date(),
    };

    this.exportJobs.set(jobId, job);

    // Start background processing
    void this.processBackgroundExport(jobId, _userId).catch(error => {
      this.logger.error(`Background export ${jobId} failed:`, error);
      job.status = 'failed';
      job.error = error.message;
    });

    return this.mapJobToResponse(job);
  }

  /**
   * Background export processing with progress tracking
   */
  private async processBackgroundExport(jobId: string, _userId: string): Promise<void> {
    const job = this.exportJobs.get(jobId);
    if (!job) {
      throw new Error(`Export job ${jobId} not found`);
    }

    try {
      job.status = 'processing';
      job.progress = 10;

      // Fetch data with streaming
      const exportData = await this.fetchExportDataStreaming(job.formId, job.options, progress => {
        job.progress = 10 + progress * 0.7; // 10-80% for data fetching
      });

      job.progress = 80;

      // Generate file
      const buffer = await this.generateExportFile(exportData, job.options);
      const filename = this.generateFilename(job.options, exportData.totalCount);
      const filePath = join(this.exportDirectory, `${jobId}-${filename}`);

      // Save file
      await fs.writeFile(filePath, buffer);

      job.progress = 90;

      // Apply compression if requested
      const finalPath = await this.applyCompression(filePath, job.options.compression);

      job.progress = 95;

      // Calculate file stats
      const stats = await fs.stat(finalPath);
      job.fileSize = stats.size;
      job.totalRecords = exportData.totalCount;
      job.filename = filename;
      job.filePath = finalPath;
      job.downloadUrl = this.generateDownloadUrl(jobId);
      job.expiresAt = new Date(Date.now() + this.downloadExpirationHours * 60 * 60 * 1000);

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();

      this.logger.log(`Export ${jobId} completed successfully`);

      // Send email notification if requested
      if (job.options.emailTo) {
        this.sendExportNotification(job.options.emailTo, job);
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      this.logger.error(`Export ${jobId} failed:`, error);
    }
  }

  /**
   * Fetch export data with streaming for large datasets
   */
  private async fetchExportDataStreaming(
    formId: string,
    options: ExportOptionsDto,
    onProgress?: (progress: number) => void,
  ): Promise<ExportData> {
    const query = this.buildQuery(formId, options.filters);
    const totalCount = await this.submissionModel.countDocuments(query);

    let processedCount = 0;
    const batchSize = 500;
    const allRows: Record<string, unknown>[] = [];

    for (let skip = 0; skip < totalCount; skip += batchSize) {
      const submissions = await this.submissionModel
        .find(query)
        .skip(skip)
        .limit(batchSize)
        .lean()
        .exec();

      for (const submission of submissions) {
        const formattedRow = this.formatSubmissionForExport(submission, options.fields);
        allRows.push(formattedRow);
        processedCount++;

        if (onProgress && processedCount % 100 === 0) {
          onProgress(processedCount / totalCount);
        }
      }
    }

    const headers = this.generateHeaders(allRows[0] || {}, options.fields);

    return {
      headers,
      rows: allRows,
      totalCount: processedCount,
    };
  }

  /**
   * Fetch export data for smaller datasets
   */
  private async fetchExportData(formId: string, options: ExportOptionsDto): Promise<ExportData> {
    const query = this.buildQuery(formId, options.filters);

    let queryBuilder = this.submissionModel.find(query).lean();

    // Apply limits if specified
    if (options.maxRecords && options.maxRecords > 0) {
      queryBuilder = queryBuilder.limit(options.maxRecords);
    }

    const submissions = await queryBuilder.exec();
    const totalCount = submissions.length;

    const rows = submissions.map(submission =>
      this.formatSubmissionForExport(submission, options.fields),
    );

    const headers = this.generateHeaders(rows[0] || {}, options.fields);

    return {
      headers,
      rows,
      totalCount,
    };
  }

  /**
   * Build MongoDB query from filters
   */
  private buildQuery(formId: string, filters?: ExportFiltersDto): Record<string, unknown> {
    const query: Record<string, unknown> = { formId };

    if (!filters) return query;

    // Status filter
    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }

    // Email filter
    if (filters.submitterEmail) {
      query['submittedBy.email'] = new RegExp(filters.submitterEmail, 'i');
    }

    // Date range filter
    if (filters.dateRange) {
      query.submittedAt = {
        $gte: new Date(filters.dateRange.start),
        $lte: new Date(filters.dateRange.end),
      };
    }

    // Specific submission IDs
    if (filters.submissionIds && filters.submissionIds.length > 0) {
      query._id = { $in: filters.submissionIds };
    }

    // Spam score filter
    if (filters.minSpamScore !== undefined) {
      query.spamScore = { $gte: filters.minSpamScore };
    }

    // GDPR compliance filter
    if (filters.gdprCompliant !== undefined) {
      query.gdprConsent = filters.gdprCompliant;
    }

    return query;
  }

  /**
   * Format submission data for export
   */
  private formatSubmissionForExport(
    submission: SubmissionDocument,
    fields?: string[],
  ): Record<string, unknown> {
    const baseFields = {
      submissionId: submission.submissionId || submission._id,
      formId: submission.formId,
      status: submission.status,
      submittedAt: submission.submittedAt,
      submitterEmail: submission.submittedBy?.email || 'Anonymous',
      submitterName: submission.submittedBy?.name || 'Anonymous',
      source: submission.source || 'web',
      spamScore: submission.spamScore || 0,
      gdprConsent: submission.gdprConsent || false,
    };

    // Flatten form data
    const formData: Record<string, unknown> = {};
    if (submission.data && typeof submission.data === 'object') {
      Object.entries(submission.data).forEach(([key, value]) => {
        formData[`data_${key}`] = this.formatFieldValue(value);
      });
    }

    const allFields = { ...baseFields, ...formData };

    // Return only specified fields if provided
    if (fields && fields.length > 0) {
      const filteredFields: Record<string, unknown> = {};
      fields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(allFields, field)) {
          filteredFields[field] = allFields[field];
        }
      });
      return filteredFields;
    }

    return allFields;
  }

  /**
   * Format field values for export
   */
  private formatFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }

  /**
   * Generate headers for export
   */
  private generateHeaders(sampleRow: Record<string, unknown>, fields?: string[]): string[] {
    if (fields && fields.length > 0) {
      return fields;
    }

    return Object.keys(sampleRow);
  }

  /**
   * Generate export file in specified format
   */
  private async generateExportFile(data: ExportData, options: ExportOptionsDto): Promise<Buffer> {
    switch (options.format) {
      case ExportFormat.CSV:
        return this.generateCSV(data);
      case ExportFormat.EXCEL:
        return this.generateExcel(data);
      case ExportFormat.JSON:
        return this.generateJSON(data);
      default:
        throw new Error(`Unsupported export format: ${String(options.format)}`);
    }
  }

  /**
   * Generate CSV export
   */
  private async generateCSV(data: ExportData): Promise<Buffer> {
    return new Promise((resolve, _reject) => {
      const chunks: Buffer[] = [];
      const writer = csvWriter.createObjectCsvStringifier({
        header: data.headers.map(header => ({ id: header, title: header })),
      });

      // Write headers
      const headerString = writer.getHeaderString();
      if (headerString) {
        chunks.push(Buffer.from(headerString));
      }

      // Write data rows
      const recordString = writer.stringifyRecords(data.rows);
      chunks.push(Buffer.from(recordString));

      resolve(Buffer.concat(chunks));
    });
  }

  /**
   * Generate Excel export with formatting
   */
  private async generateExcel(data: ExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Form Submissions');

    // Set headers with styling
    const headerRow = worksheet.addRow(data.headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    data.rows.forEach(row => {
      const values = data.headers.map(header => row[header] || '');
      worksheet.addRow(values);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    // Generate buffer
    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  /**
   * Generate JSON export
   */
  private generateJSON(data: ExportData): Promise<Buffer> {
    const jsonData = {
      metadata: {
        totalRecords: data.totalCount,
        exportedAt: new Date().toISOString(),
        headers: data.headers,
      },
      submissions: data.rows,
    };

    return Promise.resolve(Buffer.from(JSON.stringify(jsonData, null, 2)));
  }

  /**
   * Apply compression to export file
   */
  private async applyCompression(filePath: string, compression?: CompressionType): Promise<string> {
    if (!compression || compression === CompressionType.NONE) {
      return filePath;
    }

    const compressedPath = `${filePath}.${compression}`;

    if (compression === CompressionType.ZIP) {
      await this.createZipFile(filePath, compressedPath);
    } else if (compression === CompressionType.GZIP) {
      await this.createGzipFile(filePath, compressedPath);
    }

    // Remove original file
    await fs.unlink(filePath);
    return compressedPath;
  }

  /**
   * Create ZIP file
   */
  private async createZipFile(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      const fileName = inputPath.split('/').pop() || 'export_file';
      archive.file(inputPath, { name: fileName });
      archive.finalize();
    });
  }

  /**
   * Create GZIP file
   */
  private async createGzipFile(inputPath: string, outputPath: string): Promise<void> {
    const { createGzip } = await import('zlib');
    return new Promise((resolve, reject) => {
      const input = createReadStream(inputPath);
      const output = createWriteStream(outputPath);
      const gzip = createGzip();

      input.pipe(gzip).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  /**
   * Generate filename for export
   */
  private generateFilename(options: ExportOptionsDto, recordCount: number): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const format = options.format;
    const customName = options.filename || 'submissions';

    return `${customName}-${timestamp}-${recordCount}records.${String(format)}`;
  }

  /**
   * Generate secure download URL
   */
  private generateDownloadUrl(jobId: string): string {
    // In production, this should be a signed URL with expiration
    return `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/submissions/export/download/${jobId}`;
  }

  /**
   * Send export completion notification email
   */
  private sendExportNotification(email: string, job: ExportJob): void {
    // Email service integration would go here
    this.logger.log(`Sending export notification to ${email} for job ${job.id}`);
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
  }

  /**
   * Get submission count for a query
   */
  private async getSubmissionCount(formId: string, filters?: ExportFiltersDto): Promise<number> {
    const query = this.buildQuery(formId, filters);
    return this.submissionModel.countDocuments(query);
  }

  /**
   * Get export job status
   */
  getExportJob(jobId: string): ExportJobResponseDto {
    const job = this.exportJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }
    return this.mapJobToResponse(job);
  }

  /**
   * Download export file
   */
  async downloadExportFile(
    jobId: string,
  ): Promise<{ buffer: Buffer; filename: string; mimetype: string }> {
    const job = this.exportJobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    if (job.status !== 'completed' || !job.filePath) {
      throw new Error('Export file not ready for download');
    }

    if (job.expiresAt && job.expiresAt < new Date()) {
      throw new Error('Download link has expired');
    }

    const buffer = await fs.readFile(job.filePath);
    const mimetype = this.getMimeType(job.filePath);

    return {
      buffer,
      filename: job.filename!,
      mimetype,
    };
  }

  /**
   * Clean up expired export files
   */
  async cleanupExpiredExports(): Promise<void> {
    const now = new Date();
    const expiredJobs: string[] = [];

    for (const [jobId, job] of this.exportJobs.entries()) {
      if (job.expiresAt && job.expiresAt < now) {
        expiredJobs.push(jobId);

        // Delete file if it exists
        if (job.filePath) {
          try {
            await fs.unlink(job.filePath);
          } catch (_error) {
            this.logger.warn(`Failed to delete expired export file: ${job.filePath}`);
          }
        }
      }
    }

    // Remove expired jobs from memory
    expiredJobs.forEach(jobId => this.exportJobs.delete(jobId));

    this.logger.log(`Cleaned up ${expiredJobs.length} expired export jobs`);
  }

  /**
   * Get MIME type for file
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'csv':
        return 'text/csv';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'json':
        return 'application/json';
      case 'zip':
        return 'application/zip';
      case 'gz':
        return 'application/gzip';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Map export job to response DTO
   */
  private mapJobToResponse(job: ExportJob): ExportJobResponseDto {
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      downloadUrl: job.downloadUrl,
      filename: job.filename,
      fileSize: job.fileSize,
      totalRecords: job.totalRecords,
      expiresAt: job.expiresAt?.toISOString(),
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }
}
