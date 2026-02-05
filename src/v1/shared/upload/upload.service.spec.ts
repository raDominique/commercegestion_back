import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  let service: UploadService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadService],
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
      stream: undefined as any
    };

    const filePath = await service.saveFile(mockFile, destFolder);
    expect(filePath).toContain('upload');
    expect(filePath).toContain(destFolder);
    const fs = require('fs');
    expect(fs.existsSync(filePath)).toBe(true);
    // Nettoyage
    fs.unlinkSync(filePath);
    fs.rmdirSync(require('path').dirname(filePath), { recursive: true });
  });
});
