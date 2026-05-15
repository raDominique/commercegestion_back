import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CpcService } from './cpc.service';
import { CpcProduct } from './cpc.schema';
import { AuditService } from '../audit/audit.service';
import { LoggerService } from '../../common/logger/logger.service';
import { UploadService } from '../../shared/upload/upload.service';
import { ExportService } from '../../shared/export/export.service';

describe('CpcService', () => {
  let service: CpcService;

  const mockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    deleteOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    insertMany: jest.fn(),
    countDocuments: jest.fn(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CpcService,
        {
          provide: getModelToken(CpcProduct.name),
          useValue: mockModel,
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: UploadService,
          useValue: {
            saveFile: jest.fn(),
          },
        },
        {
          provide: ExportService,
          useValue: {
            exportExcel: jest.fn(),
            exportPDF: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CpcService>(CpcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
