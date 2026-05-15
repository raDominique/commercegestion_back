import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SiteService } from './sites.service';
import { Site } from './sites.schema';
import { UsersService } from '../users/users.service';
import { NotifyHelper } from '../../shared/helpers/notify.helper';

describe('SitesService', () => {
  let service: SiteService;

  const mockModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    countDocuments: jest.fn(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteService,
        {
          provide: getModelToken(Site.name),
          useValue: mockModel,
        },
        {
          provide: UsersService,
          useValue: {
            findByIds: jest.fn(),
          },
        },
        {
          provide: NotifyHelper,
          useValue: {
            notify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SiteService>(SiteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
