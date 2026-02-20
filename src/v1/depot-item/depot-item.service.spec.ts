import { Test, TestingModule } from '@nestjs/testing';
import { DepotItemService } from './depot-item.service';

describe('DepotItemService', () => {
  let service: DepotItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DepotItemService],
    }).compile();

    service = module.get<DepotItemService>(DepotItemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
