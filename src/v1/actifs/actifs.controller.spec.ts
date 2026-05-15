import { Test, TestingModule } from '@nestjs/testing';
import { ActifsController } from './actifs.controller';
import { ActifsService } from './actifs.service';

describe('ActifsController', () => {
  let controller: ActifsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActifsController],
      providers: [
        {
          provide: ActifsService,
          useValue: {
            getActifDetails: jest.fn(),
            getAvailableValidatedProducts: jest.fn(),
            getAllActifsByIdSite: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ActifsController>(ActifsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
