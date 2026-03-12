import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';
import { ConfigService } from '@nestjs/config';

const mockMailQueueService = {
  enqueue: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      APP_NAME: 'TestApp',
      APP_URL: 'http://localhost:3000',
      FRONT_URL: 'http://localhost:4200',
    };
    return config[key];
  }),
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailQueueService, useValue: mockMailQueueService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('verificationAccountUser() should enqueue the correct payload', async () => {
    await service.verificationAccountUser('user@test.com', 'Alice', 'http://verify.link');

    expect(mockMailQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(mockMailQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        template: 'email-verification',
        context: expect.objectContaining({ name: 'Alice' }),
      }),
    );
  });

  it('sendParrainValidationEmail() should enqueue the correct payload', async () => {
    await service.sendParrainValidationEmail('parrain@test.com', 'Bob', 'http://validate.link');

    expect(mockMailQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'parrain@test.com',
        template: 'parrain-validation',
        context: expect.objectContaining({ filleulName: 'Bob' }),
      }),
    );
  });

  it('notificationAdminNouveauUser() should enqueue via the queue (not bypass it)', async () => {
    await service.notificationAdminNouveauUser(
      'admin@test.com',
      'Charlie',
      'charlie@test.com',
      'USR001',
    );

    expect(mockMailQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(mockMailQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@test.com',
        template: 'admin-new-user',
      }),
    );
  });
});
