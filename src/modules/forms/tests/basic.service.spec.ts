import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Form } from '../entities/form.entity';
import { FormVersioningService } from '../form-versioning.service';
import { FormsRepository } from '../forms.repository';
import { FormsService } from '../forms.service';

describe('FormsService Basic Tests', () => {
  let service: FormsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormsService,
        {
          provide: getModelToken(Form.name),
          useValue: {
            findById: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: FormsRepository,
          useValue: {
            findWithPagination: jest.fn(),
          },
        },
        {
          provide: FormVersioningService,
          useValue: {
            createVersion: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FormsService>(FormsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have required methods', () => {
    expect(typeof service.create).toBe('function');
    expect(typeof service.findAll).toBe('function');
    expect(typeof service.findOne).toBe('function');
    expect(typeof service.update).toBe('function');
    expect(typeof service.remove).toBe('function');
    expect(typeof service.updateStatus).toBe('function');
    expect(typeof service.publishForm).toBe('function');
    expect(typeof service.archiveForm).toBe('function');
  });
});
