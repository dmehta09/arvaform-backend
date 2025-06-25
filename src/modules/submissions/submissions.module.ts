import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { CaptchaModule } from '../captcha/captcha.module';

import { FormsModule } from '../forms/forms.module';
import { Submission, SubmissionSchema } from './entities/submission.entity';
import { ExportService } from './services/export.service';
import { FileUploadService } from './services/file-upload.service';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  imports: [
    // MongoDB schema registration
    MongooseModule.forFeature([{ name: Submission.name, schema: SubmissionSchema }]),

    // File upload configuration with multer
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/submissions',
        filename: (req, file, callback) => {
          // Generate secure filename with UUID and timestamp
          const filename = `${Date.now()}-${uuid()}${extname(file.originalname)}`;
          callback(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB default limit
        files: 10, // Maximum 10 files per submission
      },
      fileFilter: (req, file, callback) => {
        // Basic file type validation (enhanced in FileUploadService)
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'text/plain',
          'text/csv',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      },
    }),

    // Import forms module for form validation
    FormsModule,
    CaptchaModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, FileUploadService, ExportService],
  exports: [SubmissionsService, FileUploadService, ExportService],
})
export class SubmissionsModule {}
