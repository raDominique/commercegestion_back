import { Global, Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { MinioStorageService } from './minio-storage.service';

@Global()
@Module({
  providers: [UploadService, MinioStorageService],
  exports: [UploadService, MinioStorageService],
})
export class UploadModule {}
