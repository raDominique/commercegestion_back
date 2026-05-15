import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuditService } from './audit.service';
import { AuditLog } from './audit-log.schema';
import { ExportService } from '../../shared/export/export.service';

describe('AuditService', () => {
  let service: AuditService;

  const mockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getModelToken(AuditLog.name),
          useValue: mockModel,
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

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
