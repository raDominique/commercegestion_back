import { Test, TestingModule } from '@nestjs/testing';
import { CpcController } from './cpc.controller';
import { CpcService } from './cpc.service';

describe('CpcController', () => {
  let controller: CpcController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CpcController],
      providers: [
        {
          provide: CpcService,
          useValue: {
            create: jest.fn(),
            getForSelect: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findChildren: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            importCpcProduct: jest.fn(),
            exportCpc: jest.fn(),
            bulkCreate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CpcController>(CpcController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
