import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { Transaction } from '../transactions/transactions.schema';
import { Actif } from '../actifs/actifs.schema';
import { Passif } from '../passifs/passifs.schema';
import { Product } from '../products/products.schema';
import { Site } from '../sites/sites.schema';
import { User } from '../users/users.schema';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockModel = {
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getModelToken(Transaction.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Actif.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Passif.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Product.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(Site.name),
          useValue: mockModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
