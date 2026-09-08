import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { MinioStorageService } from './minio-storage.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger('UploadService');

  private readonly baseUrl: string;

  constructor(
    private configService: ConfigService,
    private readonly storage: MinioStorageService,
  ) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  async saveFile(
    file: Express.Multer.File,
    destFolder = 'uploads',
  ): Promise<string> {
    try {
      const safeDestFolder = this.validateDestFolder(destFolder);
      const fileExt = path.extname(file.originalname);
      const safeName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;

      let buffer = file.buffer;
      if (file.mimetype === 'text/csv') {
        const bom = Buffer.from('\uFEFF', 'utf-8');
        buffer = Buffer.concat([bom, buffer]);
      }

      if (file.mimetype.startsWith('image/')) {
        buffer = await sharp(file.buffer)
          .resize({ width: 1024 })
          .jpeg({ quality: 80 })
          .toBuffer();
      }

      await this.storage.store(
        `${safeDestFolder}/${safeName}`,
        buffer,
        file.mimetype,
      );

      return `${this.baseUrl}/upload/${safeDestFolder}/${safeName}`;
    } catch (err) {
      this.logger.error(
        'Failed to save file',
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }

  async saveFileFromUrl(
    imageUrl: string,
    destFolder = 'products',
  ): Promise<string> {
    const safeDestFolder = this.validateDestFolder(destFolder);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Échec du téléchargement: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';

    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('webp')) ext = '.webp';

    const safeName = `${crypto.randomBytes(16).toString('hex')}${ext}`;

    if (contentType.startsWith('image/')) {
      const optimized = await sharp(buffer)
        .resize({ width: 1024 })
        .jpeg({ quality: 80 })
        .toBuffer();
      await this.storage.store(
        `${safeDestFolder}/${safeName}`,
        optimized,
        contentType,
      );
    } else {
      await this.storage.store(
        `${safeDestFolder}/${safeName}`,
        buffer,
        contentType,
      );
    }

    return `${this.baseUrl}/upload/${safeDestFolder}/${safeName}`;
  }

  private validateDestFolder(folder: string): string {
    const normalized = folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (
      !normalized ||
      normalized.split('/').some((part) => part === '.' || part === '..')
    ) {
      throw new Error('Dossier de destination invalide');
    }
    return normalized;
  }
}
