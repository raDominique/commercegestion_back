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
      stream: undefined as any,
    };

    const fileUrl = await service.saveFile(mockFile, destFolder);
    expect(fileUrl).toContain('upload');
    expect(fileUrl).toContain(destFolder);
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), fileUrl);
    expect(fs.existsSync(filePath)).toBe(true);
    // Nettoyage
    fs.unlinkSync(filePath);
    fs.rmdirSync(path.dirname(filePath), { recursive: true });
  });
});
