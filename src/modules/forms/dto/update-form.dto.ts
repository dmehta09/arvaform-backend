import { PartialType } from '@nestjs/swagger';
import { CreateFormDto } from './create-form.dto';

/**
 * DTO for updating a form
 * All fields are optional for partial updates
 */
export class UpdateFormDto extends PartialType(CreateFormDto) {}
