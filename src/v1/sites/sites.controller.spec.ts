import { Test, TestingModule } from '@nestjs/testing';
import { SiteController } from './sites.controller';
import { SiteService } from './sites.service';

describe('SitesController', () => {
  let controller: SiteController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiteController],
      providers: [SiteService],
    }).compile();

    controller = module.get<SiteController>(SiteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
