import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormVersion, FormVersionSchema } from './entities/form-version.entity';
import { Form, FormSchema } from './entities/form.entity';
import { FormVersioningService } from './form-versioning.service';
import { FormsInitializationService } from './forms-initialization.service';
import { FormsController } from './forms.controller';
import { FormsRepository } from './forms.repository';
import { FormsService } from './forms.service';
import { FormOwnershipGuard } from './guards/form-ownership.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Form.name, schema: FormSchema },
      { name: FormVersion.name, schema: FormVersionSchema },
    ]),
  ],
  controllers: [FormsController],
  providers: [
    FormsService,
    FormsRepository,
    FormVersioningService,
    FormsInitializationService,
    FormOwnershipGuard,
  ],
  exports: [FormsService, FormsRepository, FormVersioningService],
})
export class FormsModule {}
