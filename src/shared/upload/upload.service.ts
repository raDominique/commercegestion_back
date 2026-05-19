import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger('UploadService');

  private readonly publicPath = path.join(process.cwd(), 'upload');
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  async saveFile(
    file: Express.Multer.File,
    destFolder = 'uploads',
  ): Promise<string> {
    try {
      const folderPath = path.join(this.publicPath, destFolder);
      if (!fs.existsSync(folderPath))
        fs.mkdirSync(folderPath, { recursive: true });

      const fileExt = path.extname(file.originalname);
      let safeName: string;
      let filePath: string;
      do {
        const hash = crypto.randomBytes(16).toString('hex');
        safeName = `${hash}${fileExt}`;
        filePath = path.join(folderPath, safeName);
      } while (fs.existsSync(filePath));

      let buffer = file.buffer;
      if (file.mimetype === 'text/csv') {
        const bom = Buffer.from('\uFEFF', 'utf-8');
        buffer = Buffer.concat([bom, buffer]);
      }

      if (file.mimetype.startsWith('image/')) {
        await sharp(file.buffer)
          .resize({ width: 1024 })
          .jpeg({ quality: 80 })
          .toFile(filePath);
      } else {
        fs.writeFileSync(filePath, buffer);
      }

      this.logger.log(`File saved: ${filePath}`);

      return `${this.baseUrl}/upload/${destFolder}/${safeName}`;
    } catch (err) {
      this.logger.error('Failed to save file', err.stack);
      throw err;
    }
  }
}
