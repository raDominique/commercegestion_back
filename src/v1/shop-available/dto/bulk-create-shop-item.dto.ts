import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateShopItemDto } from './create-shop-item.dto';
import { BULK_MAX_ITEMS } from '../../../shared/bulk';

export class BulkCreateShopItemDto {
  @ApiProperty({
    type: [CreateShopItemDto],
    description: `Liste des annonces à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateShopItemDto)
  items!: CreateShopItemDto[];
}
