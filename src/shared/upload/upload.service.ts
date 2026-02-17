import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger('UploadService');

  private readonly publicPath = path.join(process.cwd(), 'upload');

  /**
   * Sauvegarde un fichier (image compressée si image)
   * @param file Express.Multer.File
   * @param destFolder dossier de destination
   * @returns URL publique du fichier sauvegardé
   */
  async saveFile(
    file: Express.Multer.File,
    destFolder = 'uploads',
  ): Promise<string> {
    try {
      const folderPath = path.join(this.publicPath, destFolder);
      if (!fs.existsSync(folderPath))
        fs.mkdirSync(folderPath, { recursive: true });

      // Nom unique
      const fileExt = path.extname(file.originalname);
      let safeName: string;
      let filePath: string;
      do {
        const hash = crypto.randomBytes(16).toString('hex');
        safeName = `${hash}${fileExt}`;
        filePath = path.join(folderPath, safeName);
      } while (fs.existsSync(filePath));

      if (file.mimetype.startsWith('image/')) {
        await sharp(file.buffer)
          .resize({ width: 1024 })
          .jpeg({ quality: 80 })
          .toFile(filePath);
      } else {
        fs.writeFileSync(filePath, file.buffer);
      }

      this.logger.log(`File saved: ${filePath}`);

      // Retourner l’URL publique
      return `/upload/${destFolder}/${safeName}`;
    } catch (err) {
      this.logger.error('Failed to save file', err.stack);
      throw err;
    }
  }
}
