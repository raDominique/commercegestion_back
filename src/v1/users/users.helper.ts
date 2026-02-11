import { BadRequestException } from '@nestjs/common';

const DOCUMENT_MIME_RULES: Record<string, RegExp> = {
  cin: /pdf|jpeg|jpg|png/,
  passport: /pdf|jpeg|jpg|png/,
  'permis-de-conduire': /pdf|jpeg|jpg|png/,
  'carte-fiscale': /pdf|jpeg|jpg|png/,
};

export function validateDocumentMime(
  files: Express.Multer.File[],
  documentType?: string,
) {
  if (!files?.length) return;

  const rule = DOCUMENT_MIME_RULES[documentType ?? ''];
  if (!rule) {
    throw new BadRequestException('Type de document non supporté');
  }

  for (const file of files) {
    if (!rule.test(file.mimetype)) {
      throw new BadRequestException(
        `MIME invalide pour ${documentType}: ${file.mimetype}`,
      );
    }
  }
}
