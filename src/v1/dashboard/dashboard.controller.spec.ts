import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { LedgerDisplayService } from '../ledger-display/ledger-display.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let ledgerDisplayService: LedgerDisplayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: LedgerDisplayService,
          useValue: {
            getActifsAndPassifsStats: jest.fn(),
            getActifsAndPassifsStatsBySite: jest.fn(),
            getActifsAndPassifsStatsByProduct: jest.fn(),
            getActifsAndPassifsWithDetailsByProduct: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    ledgerDisplayService =
      module.get<LedgerDisplayService>(LedgerDisplayService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
