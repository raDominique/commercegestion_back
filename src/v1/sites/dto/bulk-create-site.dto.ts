import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSiteDto } from './create-site.dto';
import { BULK_MAX_ITEMS } from '../../../shared/bulk';

export class BulkCreateSiteDto {
  @ApiProperty({
    type: [CreateSiteDto],
    description: `Liste des sites à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateSiteDto)
  items!: CreateSiteDto[];
}
