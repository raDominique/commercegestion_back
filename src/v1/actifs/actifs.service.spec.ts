import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ActifsService } from './actifs.service';
import { Actif } from './actifs.schema';
import { ProductService } from '../products/products.service';

describe('ActifsService', () => {
  let service: ActifsService;

  const mockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActifsService,
        {
          provide: getModelToken(Actif.name),
          useValue: mockModel,
        },
        {
          provide: ProductService,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ActifsService>(ActifsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
