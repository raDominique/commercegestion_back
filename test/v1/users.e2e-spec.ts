import { INestApplication, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { UsersController } from '../../src/v1/users/users.controller';
import { UsersService } from '../../src/v1/users/users.service';

@Module({
  controllers: [UsersController],
  providers: [
    {
      provide: UsersService,
      useValue: {
        findOne: jest.fn(),
        findAllPaginated: jest.fn(),
        findAllNoPaginated: jest.fn(),
        verifyAccountToken: jest.fn(),
      },
    },
  ],
})
class UsersModuleForE2e {}

@Module({
  imports: [
    UsersModuleForE2e,
    RouterModule.register([{ path: 'v1/users', module: UsersModuleForE2e }]),
  ],
})
class RootE2eModule {}

describe('V1 Users (e2e)', () => {
  let app: INestApplication;
  let usersService: {
    findOne: jest.Mock;
    findAllPaginated: jest.Mock;
    findAllNoPaginated: jest.Mock;
    verifyAccountToken: jest.Mock;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RootE2eModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    usersService = moduleFixture.get(UsersService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/users/get-by-id/:id', async () => {
    const mockUser = { _id: 'u1', userEmail: 'test@example.com' };
    usersService.findOne.mockResolvedValueOnce(mockUser);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/get-by-id/u1')
      .expect(200);

    expect(res.body).toEqual(mockUser);
    expect(usersService.findOne).toHaveBeenCalledWith('u1');
  });

  it('GET /api/v1/users (pagination + query parsing)', async () => {
    const mockResult = {
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    };
    usersService.findAllPaginated.mockResolvedValueOnce(mockResult);

    const res = await request(app.getHttpServer())
      .get(
        '/api/v1/users?page=2&limit=5&search=abc&sortBy=createdAt&order=asc&isActive=true&isVerified=false',
      )
      .expect(200);

    expect(res.body).toEqual(mockResult);
    expect(usersService.findAllPaginated).toHaveBeenCalledWith(
      2,
      5,
      'abc',
      'createdAt',
      'asc',
      {
        userType: undefined,
        isActive: true,
        isVerified: false,
      },
    );
  });

  it('GET /api/v1/users/select/all', async () => {
    const mockUsers = [{ _id: 'u1' }, { _id: 'u2' }];
    usersService.findAllNoPaginated.mockResolvedValueOnce(mockUsers);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users/select/all')
      .expect(200);

    expect(res.body).toEqual(mockUsers);
    expect(usersService.findAllNoPaginated).toHaveBeenCalledTimes(1);
  });

  it('GET /api/v1/users/verify redirects', async () => {
    usersService.verifyAccountToken.mockResolvedValueOnce(
      'https://frontend.local/verified',
    );

    await request(app.getHttpServer())
      .get('/api/v1/users/verify?token=tok123')
      .expect(302)
      .expect('Location', 'https://frontend.local/verified');

    expect(usersService.verifyAccountToken).toHaveBeenCalledWith('tok123');
  });
});
