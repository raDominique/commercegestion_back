import { memoryStorage } from 'multer';

export const multerMemoryConfig = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
};
