import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailQueueService } from './mail-queue.service';
import { MailJob, MailJobStatus } from './schemas/mail-job.schema';

function chain(resolvedValue: unknown) {
  return {
    exec: jest.fn().mockResolvedValue(resolvedValue),
  } as any;
}

function mockJobDoc(overrides: Partial<MailJob> = {}): any {
  const doc: any = {
    to: 'user@test.com',
    subject: 'Sujet',
    template: 'tpl',
    context: {},
    status: MailJobStatus.PENDING,
    attempts: 0,
    maxRetries: 2,
    nextAttemptAt: new Date(),
    ...overrides,
    save: jest.fn().mockResolvedValue(undefined),
  };
  return doc;
}

describe('MailQueueService', () => {
  let service: MailQueueService;
  let model: any;
  let mailerService: { sendMail: jest.Mock };

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue(mockJobDoc()),
      findOneAndUpdate: jest.fn().mockReturnValue(chain(null)),
      findOne: jest.fn().mockReturnValue(chain(null)),
      countDocuments: jest.fn().mockReturnValue(chain(0)),
      updateMany: jest.fn().mockReturnValue(chain({ n: 0 })),
    };
    mailerService = { sendMail: jest.fn().mockResolvedValue({ accepted: [] }) };

    // Éviter que le worker ne s'exécute réellement pendant les tests d'enqueue
    const processQueueSpy = jest
      .spyOn(MailQueueService.prototype as any, 'processQueue')
      .mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailQueueService,
        { provide: MailerService, useValue: mailerService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                MAIL_SEND_DELAY_MS: '0',
                MAIL_MAX_RETRIES: '2',
                ADMIN_EMAIL: 'admin@test.com',
                APP_NAME: 'TestApp',
              };
              return config[key];
            }),
          },
        },
        { provide: getModelToken(MailJob.name), useValue: model },
      ],
    }).compile();

    service = module.get<MailQueueService>(MailQueueService);
    (service as any)._processQueueSpy = processQueueSpy;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('enqueue() should ignore invalid email addresses', async () => {
    await service.enqueue({
      to: 'pas-une-adresse',
      subject: 'Sujet',
      template: 'tpl',
      context: {},
    });

    expect(model.create).not.toHaveBeenCalled();
  });

  it('enqueue() should ignore when shutting down', async () => {
    service['isShuttingDown'] = true;
    await service.enqueue({
      to: 'user@test.com',
      subject: 'Sujet',
      template: 'tpl',
      context: {},
    });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('enqueue() should persist a valid job as PENDING', async () => {
    await service.enqueue({
      to: 'user@test.com',
      subject: 'Bonjour',
      template: 'email-verification',
      context: { name: 'Alice' },
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Bonjour',
        template: 'email-verification',
        context: { name: 'Alice' },
        status: MailJobStatus.PENDING,
        attempts: 0,
        maxRetries: 2,
      }),
    );
  });

  it('getStats() should return aggregated counts', async () => {
    model.countDocuments.mockImplementation(() => chain(0));

    const stats = await service.getStats();

    expect(stats).toEqual(
      expect.objectContaining({
        pending: 0,
        sentLast24h: 0,
        failedLast24h: 0,
        maxRetries: 2,
      }),
    );
  });

  it('onModuleInit() should reset SENDING jobs to PENDING (crash recovery)', async () => {
    await service.onModuleInit();

    expect(model.updateMany).toHaveBeenCalledWith(
      { status: MailJobStatus.SENDING },
      {
        $set: {
          status: MailJobStatus.PENDING,
          nextAttemptAt: expect.any(Date),
        },
      },
    );
  });

  describe('processJob', () => {
    it('should mark job SENT on successful send', async () => {
      const job = mockJobDoc({ to: 'user@test.com', template: 'tpl' });
      await service['processJob'](job);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@test.com' }),
      );
      expect(job.status).toBe(MailJobStatus.SENT);
      expect(job.sentAt).toBeInstanceOf(Date);
      expect(job.save).toHaveBeenCalled();
    });

    it('should retry on failure and requeue with backoff', async () => {
      mailerService.sendMail.mockRejectedValueOnce(
        new Error('SMTP temporaire'),
      );
      const job = mockJobDoc({
        to: 'user@test.com',
        template: 'tpl',
        maxRetries: 2,
        status: MailJobStatus.SENDING,
      });

      await service['processJob'](job);

      expect(job.attempts).toBe(1);
      expect(job.status).toBe(MailJobStatus.PENDING);
      expect(job.lastError).toBe('SMTP temporaire');
      expect(job.nextAttemptAt).toBeInstanceOf(Date);
    });

    it('should mark FAILED and alert admin after max retries', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP définitif'));
      const job = mockJobDoc({
        to: 'user@test.com',
        template: 'tpl',
        maxRetries: 0,
        attempts: 0,
        status: MailJobStatus.SENDING,
      });

      await service['processJob'](job);

      expect(job.status).toBe(MailJobStatus.FAILED);
      expect(job.lastError).toBe('SMTP définitif');

      // L'alerte admin est envoyée directement (pas via la queue)
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@test.com' }),
      );
    });
  });
});
