import { INestApplication, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppController } from '../../src/v1/app.controller';
import { AppService } from '../../src/v1/app.service';
import { UploadService } from '../../src/shared/upload/upload.service';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: UploadService,
      useValue: {
        saveFile: jest.fn().mockResolvedValue('http://mock.local/avatar.png'),
      },
    },
  ],
})
class V1ModuleForE2e {}

@Module({
  imports: [
    V1ModuleForE2e,
    RouterModule.register([{ path: 'v1', module: V1ModuleForE2e }]),
  ],
})
class RootE2eModule {}

describe('V1 (e2e)', () => {
  let app: INestApplication;
  let uploadService: { saveFile: jest.Mock };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [RootE2eModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');

    uploadService = moduleFixture.get(UploadService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('POST /api/v1/upload-test', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/upload-test')
      .attach('file', Buffer.from('dummy'), 'avatar.png')
      .expect(201);

    expect(res.body).toEqual({ avatarUrl: 'http://mock.local/avatar.png' });
    expect(uploadService.saveFile).toHaveBeenCalledWith(
      expect.any(Object),
      'avatars',
    );
  });
});
