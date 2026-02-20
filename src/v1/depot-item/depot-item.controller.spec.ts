import { Test, TestingModule } from '@nestjs/testing';
import { DepotItemController } from './depot-item.controller';
import { DepotItemService } from './depot-item.service';

describe('DepotItemController', () => {
  let controller: DepotItemController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepotItemController],
      providers: [DepotItemService],
    }).compile();

    controller = module.get<DepotItemController>(DepotItemController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
