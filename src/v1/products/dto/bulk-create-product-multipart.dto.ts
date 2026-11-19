import { ApiProperty, OmitType } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';
import { BulkProductItemDto } from './bulk-create-product.dto';
import { BULK_MAX_ITEMS } from '../../../shared/bulk';

/**
 * Produit d'un lot multipart : mêmes champs que le bulk JSON, sans `imageUrl`
 * (l'image est envoyée comme fichier `image_<index>`). La catégorie est
 * déduite du `codeCPC`.
 */
export class BulkProductMultipartItemDto extends OmitType(BulkProductItemDto, [
  'imageUrl',
] as const) {}

/**
 * Body multipart : `items` est une chaîne JSON (tableau de produits), car un
 * champ multipart ne transporte que du texte. Les images sont des fichiers
 * séparés, nommés `image_<index>` (index dans `items`).
 */
export class BulkCreateProductMultipartDto {
  @ApiProperty({
    type: 'string',
    description: `Tableau JSON des produits (1 à ${BULK_MAX_ITEMS}), sérialisé avec JSON.stringify`,
    example:
      '[{"codeCPC":"01111","productName":"Blé dur"},{"codeCPC":"01121","productName":"Maïs"}]',
  })
  @Transform(({ value }) => parseItems(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  items!: BulkProductMultipartItemDto[];
}

function parseItems(value: unknown): unknown {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException(
        'items doit être un tableau JSON valide (JSON.stringify côté front).',
      );
    }
  }
  if (!Array.isArray(parsed)) return parsed;
  return parsed.map((item: unknown) =>
    item && typeof item === 'object'
      ? plainToInstance(BulkProductMultipartItemDto, item)
      : item,
  );
}
