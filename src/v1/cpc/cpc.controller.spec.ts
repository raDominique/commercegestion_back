import { Test, TestingModule } from '@nestjs/testing';
import { CpcController } from './cpc.controller';
import { CpcService } from './cpc.service';

describe('CpcController', () => {
  let controller: CpcController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CpcController],
      providers: [CpcService],
    }).compile();

    controller = module.get<CpcController>(CpcController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
