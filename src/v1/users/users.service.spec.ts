import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './users.schema';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: any;

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      find: jest.fn(),
      exec: jest.fn(),
      save: jest.fn(),
    };
    const loggerMock = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: LoggerService, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return error if user already exists on create', async () => {
    userModel.findOne.mockResolvedValue({ email: 'test@test.com' });
    await expect(
      service.create({ email: 'test@test.com', password: 'password123' })
    ).rejects.toThrow('Email already exists');
  });

  it('should create user if not exists', async () => {
    userModel.findOne.mockResolvedValue(null);
    userModel.save = jest.fn().mockResolvedValue({ _id: '1', email: 'test@test.com' });
    userModel.constructor = function (dto: any) { return { ...dto, save: userModel.save } };
    const result = await service.create({ email: 'test@test.com', password: 'password123' });
    expect(result.status).toBe('success');
    expect(result.data && result.data[0] && result.data[0].email).toBe('test@test.com');
  });
});
