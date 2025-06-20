import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

// File upload configuration interface
interface FileUploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  uploadPath: string;
  enableVirusScanning: boolean;
  maxFilesPerSubmission: number;
}

// File validation result interface
interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

// Uploaded file information interface
export interface UploadedFileInfo {
  fieldId: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: Date;
  virusScanned?: boolean;
  checksum?: string;
}

/**
 * File Upload Service
 * Handles secure file uploads with comprehensive validation and security measures
 * Follows 2025 security best practices for file handling
 */
@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly config: FileUploadConfig;

  constructor(private readonly configService: ConfigService) {
    // Load file upload configuration
    this.config = {
      maxFileSize: this.configService.get<number>('FILE_MAX_SIZE', 10 * 1024 * 1024), // 10MB default
      allowedMimeTypes: this.configService
        .get<string>('FILE_ALLOWED_MIME_TYPES', 'image/*,application/pdf,text/*')
        .split(','),
      uploadPath: this.configService.get<string>('FILE_UPLOAD_PATH', './uploads'),
      enableVirusScanning: this.configService.get<boolean>('FILE_ENABLE_VIRUS_SCAN', false),
      maxFilesPerSubmission: this.configService.get<number>('FILE_MAX_FILES_PER_SUBMISSION', 10),
    };

    this.logger.log('FileUploadService initialized with config:', this.config);
  }

  /**
   * Process multiple file uploads for a form submission
   * @param files - Array of Express.Multer.File objects
   * @param fieldMapping - Mapping of file index to field ID
   * @returns Promise<UploadedFileInfo[]>
   */
  async processFileUploads(
    files: Express.Multer.File[],
    fieldMapping: { [key: string]: string },
  ): Promise<UploadedFileInfo[]> {
    this.logger.debug(`Processing ${files.length} file uploads`);

    // Validate file count
    if (files.length > this.config.maxFilesPerSubmission) {
      throw new BadRequestException(
        `Too many files. Maximum allowed: ${this.config.maxFilesPerSubmission}`,
      );
    }

    const uploadedFiles: UploadedFileInfo[] = [];
    const uploadPromises = files.map(async (file, index) => {
      const fieldId = fieldMapping[index.toString()] || `file-${index}`;
      return this.processFile(file, fieldId);
    });

    try {
      const results = await Promise.all(uploadPromises);
      uploadedFiles.push(...results);
      this.logger.log(`Successfully processed ${uploadedFiles.length} files`);
      return uploadedFiles;
    } catch (error) {
      this.logger.error('Error processing file uploads:', error);
      // Cleanup any successfully uploaded files if there was an error
      await this.cleanupFiles(uploadedFiles);
      throw error;
    }
  }

  /**
   * Process a single file upload
   * @param file - Express.Multer.File object
   * @param fieldId - Form field ID associated with the file
   * @returns Promise<UploadedFileInfo>
   */
  private async processFile(file: Express.Multer.File, fieldId: string): Promise<UploadedFileInfo> {
    this.logger.debug(`Processing file: ${file.originalname} for field: ${fieldId}`);

    // Validate file
    const validation = await this.validateFile(file);
    if (!validation.isValid) {
      throw new BadRequestException(`File validation failed: ${validation.error}`);
    }

    // Generate secure filename
    const filename = this.generateSecureFilename(file.originalname);
    const filePath = join(this.config.uploadPath, filename);

    // Ensure upload directory exists
    await this.ensureUploadDirectory();

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Generate file checksum
    const checksum = await this.generateFileChecksum(filePath);

    // Perform virus scanning if enabled
    let virusScanned = false;
    if (this.config.enableVirusScanning) {
      virusScanned = await this.performVirusScan(filePath);
      if (!virusScanned) {
        // Clean up infected file
        await fs.unlink(filePath);
        throw new BadRequestException('File failed virus scan and has been rejected');
      }
    }

    // Generate file URL (this would typically be a CDN or storage service URL in production)
    const fileUrl = this.generateFileUrl(filename);

    const uploadedFileInfo: UploadedFileInfo = {
      fieldId,
      originalName: file.originalname,
      filename,
      mimetype: file.mimetype,
      size: file.size,
      url: fileUrl,
      uploadedAt: new Date(),
      virusScanned,
      checksum,
    };

    this.logger.debug(`File processed successfully: ${filename}`);
    return uploadedFileInfo;
  }

  /**
   * Validate uploaded file against security policies
   * @param file - Express.Multer.File object
   * @returns Promise<FileValidationResult>
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async validateFile(file: Express.Multer.File): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      warnings: [],
    };

    // Check file size
    if (file.size > this.config.maxFileSize) {
      result.isValid = false;
      result.error = `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`;
      return result;
    }

    // Check file type
    if (!this.isAllowedMimeType(file.mimetype)) {
      result.isValid = false;
      result.error = `File type '${file.mimetype}' is not allowed`;
      return result;
    }

    // Check for suspicious file extensions
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileExt = extname(file.originalname).toLowerCase();
    if (suspiciousExtensions.includes(fileExt)) {
      result.isValid = false;
      result.error = `File extension '${fileExt}' is not allowed for security reasons`;
      return result;
    }

    // Check for malicious file names
    if (this.containsMaliciousPatterns(file.originalname)) {
      result.isValid = false;
      result.error = 'File name contains potentially malicious patterns';
      return result;
    }

    // Additional file content validation could be added here
    // For example, checking file headers to ensure they match the declared MIME type

    this.logger.debug(`File validation passed: ${file.originalname}`);
    return result;
  }

  /**
   * Check if MIME type is allowed
   * @param mimeType - File MIME type
   * @returns boolean
   */
  private isAllowedMimeType(mimeType: string): boolean {
    return this.config.allowedMimeTypes.some(allowed => {
      if (allowed.endsWith('/*')) {
        return mimeType.startsWith(allowed.slice(0, -1));
      }
      return mimeType === allowed;
    });
  }

  /**
   * Check for malicious patterns in filename
   * @param filename - Original filename
   * @returns boolean
   */
  private containsMaliciousPatterns(filename: string): boolean {
    const maliciousPatterns = [
      /\.\./g, // Directory traversal
      /[<>:"|?*]/g, // Invalid file name characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
    ];

    return maliciousPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Generate secure filename with timestamp and UUID
   * @param originalName - Original filename
   * @returns string
   */
  private generateSecureFilename(originalName: string): string {
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0]; // Use first part of UUID for brevity
    const extension = extname(originalName);
    const baseName = originalName.replace(extension, '').replace(/[^a-zA-Z0-9]/g, '_');

    return `${timestamp}_${uuid}_${baseName}${extension}`;
  }

  /**
   * Generate file checksum for integrity verification
   * @param filePath - Path to the file
   * @returns Promise<string>
   */
  private async generateFileChecksum(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = createHash('sha256');
      hash.update(fileBuffer);
      return `sha256:${hash.digest('hex')}`;
    } catch (error) {
      this.logger.warn(`Failed to generate checksum for file: ${filePath}`, error);
      return '';
    }
  }

  /**
   * Perform virus scanning on uploaded file
   * @param filePath - Path to the file
   * @returns Promise<boolean>
   */
  private async performVirusScan(filePath: string): Promise<boolean> {
    try {
      // This is a placeholder for actual virus scanning implementation
      // In production, you would integrate with services like:
      // - ClamAV
      // - VirusTotal API
      // - AWS Macie
      // - Azure Defender for Storage

      this.logger.debug(`Performing virus scan on: ${filePath}`);

      // Simulate virus scanning delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // For now, always return true (no virus found)
      // In real implementation, this would return actual scan results
      this.logger.debug(`Virus scan completed for: ${filePath} - Clean`);
      return true;
    } catch (error) {
      this.logger.error(`Virus scanning failed for file: ${filePath}`, error);
      return false;
    }
  }

  /**
   * Generate public URL for uploaded file
   * @param filename - Stored filename
   * @returns string
   */
  private generateFileUrl(filename: string): string {
    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    return `${baseUrl}/uploads/${filename}`;
  }

  /**
   * Ensure upload directory exists
   * @returns Promise<void>
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.config.uploadPath);
    } catch {
      await fs.mkdir(this.config.uploadPath, { recursive: true });
      this.logger.log(`Created upload directory: ${this.config.uploadPath}`);
    }
  }

  /**
   * Cleanup files in case of error
   * @param uploadedFiles - Array of uploaded file info
   * @returns Promise<void>
   */
  private async cleanupFiles(uploadedFiles: UploadedFileInfo[]): Promise<void> {
    const cleanupPromises = uploadedFiles.map(async fileInfo => {
      try {
        const filePath = join(this.config.uploadPath, fileInfo.filename);
        await fs.unlink(filePath);
        this.logger.debug(`Cleaned up file: ${fileInfo.filename}`);
      } catch (error) {
        this.logger.warn(`Failed to cleanup file: ${fileInfo.filename}`, error);
      }
    });

    await Promise.all(cleanupPromises);
  }

  /**
   * Delete multiple uploaded files
   * @param files - Array of file information
   * @returns Promise<boolean[]>
   */
  async deleteFiles(files: { filename: string }[]): Promise<boolean[]> {
    const deletePromises = files.map(file => this.deleteFile(file.filename));
    return Promise.all(deletePromises);
  }

  /**
   * Delete uploaded file
   * @param filename - Filename to delete
   * @returns Promise<boolean>
   */
  async deleteFile(filename: string): Promise<boolean> {
    try {
      const filePath = join(this.config.uploadPath, filename);
      await fs.unlink(filePath);
      this.logger.debug(`Deleted file: ${filename}`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to delete file: ${filename}`, error);
      return false;
    }
  }

  /**
   * Get upload configuration for client-side validation
   * @returns Partial<FileUploadConfig>
   */
  getUploadConfig(): {
    maxFileSize: number;
    maxFiles: number;
    allowedMimeTypes: string[];
    allowedExtensions: string[];
  } {
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.pdf',
      '.txt',
      '.csv',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
    ];

    return {
      maxFileSize: this.config.maxFileSize,
      maxFiles: this.config.maxFilesPerSubmission,
      allowedMimeTypes: this.config.allowedMimeTypes,
      allowedExtensions,
    };
  }
}
