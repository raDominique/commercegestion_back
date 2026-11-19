import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AddCartItemDto } from './add-cart-item.dto';
import { BULK_MAX_ITEMS } from '../../../shared/bulk';

export class BulkAddCartItemDto {
  @ApiProperty({
    type: [AddCartItemDto],
    description: `Articles à ajouter au panier (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}
