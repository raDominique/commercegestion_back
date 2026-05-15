import { Test, TestingModule } from '@nestjs/testing';
import { SiteController } from './sites.controller';
import { SiteService } from './sites.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('SitesController', () => {
  let controller: SiteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiteController],
      providers: [
        {
          provide: SiteService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findAllByUser: jest.fn(),
            findByLocation: jest.fn(),
            findAllSelect: jest.fn(),
            getAllSitesByUserId: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<SiteController>(SiteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
