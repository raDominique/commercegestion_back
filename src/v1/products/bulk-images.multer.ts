import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { BULK_MAX_ITEMS } from '../../shared/bulk';

/** Champ fichier attendu : `image_<index>` (index du produit dans `items`). */
export const BULK_IMAGE_FIELD = /^image_(\d+)$/;

/** Multer pour le bulk produits : images uniquement, 5 Mo max chacune. */
export const productBulkImagesMulter: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: BULK_MAX_ITEMS },
  fileFilter: (_req, file, callback) => {
    if (!BULK_IMAGE_FIELD.test(file.fieldname)) {
      return callback(
        new BadRequestException(
          `Champ fichier "${file.fieldname}" invalide : utiliser image_<index> (ex: image_0).`,
        ),
        false,
      );
    }
    if (!file.mimetype.startsWith('image/')) {
      return callback(
        new BadRequestException(
          `${file.fieldname} : seules les images sont acceptées (reçu ${file.mimetype}).`,
        ),
        false,
      );
    }
    callback(null, true);
  },
};
