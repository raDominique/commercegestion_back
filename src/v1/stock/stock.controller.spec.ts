import { Test, TestingModule } from '@nestjs/testing';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';

describe('StockController', () => {
  let controller: StockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        {
          provide: StockService,
          useValue: {
            createMovement: jest.fn(),
            getSiteActifs: jest.fn(),
            getSitePassifs: jest.fn(),
            getDepositList: jest.fn(),
            getWithdrawList: jest.fn(),
            flagMovement: jest.fn(),
            validateMovementFlag: jest.fn(),
          },
        },
        {
          provide: ActifsService,
          useValue: {
            getActifDetails: jest.fn(),
          },
        },
        {
          provide: PassifsService,
          useValue: {
            getPassifDetails: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<StockController>(StockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
