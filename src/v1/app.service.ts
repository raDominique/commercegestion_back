import { Injectable } from '@nestjs/common';
import { UploadService } from '../shared/upload/upload.service';

@Injectable()
export class AppService {
  constructor(private readonly uploadService: UploadService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async updateAvatar(file: Express.Multer.File) {
    // Compression activée pour les avatars
    const avatarUrl = await this.uploadService.saveFile(file, 'avatars');

    // Stocker avatarUrl dans la DB
    return { avatarUrl };
  }
}
