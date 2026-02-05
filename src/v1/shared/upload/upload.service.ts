import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger('UploadService');

  /**
   * Sauvegarde un fichier (image compressée si image)
   * @param file Express.Multer.File
   * @param destFolder dossier de destination
   * @returns chemin complet du fichier sauvegardé
   */
  async saveFile(file: Express.Multer.File, destFolder = 'uploads'): Promise<string> {
    try {
      // Place le fichier dans 'upload/destFolder'
      const folderPath = path.join(process.cwd(), 'upload', destFolder);
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      // Génération d'un nom unique et sécurisé, éviter les doublons
      const fileExt = path.extname(file.originalname);
      let safeName: string;
      let filePath: string;
      do {
        const hash = crypto.randomBytes(16).toString('hex');
        safeName = `${hash}${fileExt}`;
        filePath = path.join(folderPath, safeName);
      } while (fs.existsSync(filePath));

      if (file.mimetype.startsWith('image/')) {
        // Compression et resize de l'image
        await sharp(file.buffer)
          .resize({ width: 1024 })
          .jpeg({ quality: 80 })
          .toFile(filePath);
      } else {
        // Sauvegarde brute pour les autres fichiers
        fs.writeFileSync(filePath, file.buffer);
      }

      this.logger.log(`File saved: ${filePath}`);
      return filePath;
    } catch (err) {
      this.logger.error('Failed to save file', err.stack);
      throw err;
    }
  }
}
