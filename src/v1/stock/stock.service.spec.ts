import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StockService } from './stock.service';
import { StockMovement } from './stock-movement.schema';
import { ProductService } from '../products/products.service';
import { SiteService } from '../sites/sites.service';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MailService } from '../../shared/mail/mail.service';
import { ExportService } from '../../shared/export/export.service';

describe('StockService', () => {
  let service: StockService;

  const mockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: getModelToken(StockMovement.name),
          useValue: mockModel,
        },
        {
          provide: ProductService,
          useValue: {
            findById: jest.fn(),
            updateStock: jest.fn(),
          },
        },
        {
          provide: SiteService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: ActifsService,
          useValue: {
            addOrIncreaseActif: jest.fn(),
            decreaseActif: jest.fn(),
          },
        },
        {
          provide: PassifsService,
          useValue: {
            addOrIncreasePassif: jest.fn(),
            decreasePassif: jest.fn(),
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
          provide: MailService,
          useValue: {
            sendMail: jest.fn(),
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

    service = module.get<StockService>(StockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
