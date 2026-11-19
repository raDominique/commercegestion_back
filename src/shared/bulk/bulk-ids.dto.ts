import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from 'class-validator';
import { BULK_MAX_ITEMS } from './bulk.helper';

/** Body `{ ids: [...] }` pour les actions en masse sur des documents existants. */
export class BulkIdsDto {
  @ApiProperty({
    type: [String],
    description: `Liste d'IDs MongoDB (1 à ${BULK_MAX_ITEMS}, sans doublon)`,
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  ids!: string[];
}
