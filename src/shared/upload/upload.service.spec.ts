import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { MinioStorageService } from './minio-storage.service';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        MinioStorageService,
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should save a text file in upload/destFolder', async () => {
    const destFolder = 'testfolder';
    const mockFile: Express.Multer.File = {
      originalname: 'test.txt',
      mimetype: 'text/plain',
      buffer: Buffer.from('Hello world!'),
      fieldname: '',
      encoding: '',
      size: 12,
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from([]),
    };

    const fileUrl = await service.saveFile(mockFile, destFolder);
    expect(fileUrl).toContain('upload');
    expect(fileUrl).toContain(destFolder);
    const filePath = path.join(
      process.cwd(),
      'upload',
      destFolder,
      fileUrl.split('/').pop() as string,
    );
    expect(fs.existsSync(filePath)).toBe(true);
    // Nettoyage
    fs.unlinkSync(filePath);
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  });
});
