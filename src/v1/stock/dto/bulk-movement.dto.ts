import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateMovementDto } from './create-movement.dto';
import { BULK_MAX_ITEMS, BulkIdsDto } from '../../../shared/bulk';

/** Body des créations de mouvements en masse (dépôt, transfert, virement). */
export class BulkCreateMovementDto {
  @ApiProperty({
    type: [CreateMovementDto],
    description: `Liste des mouvements à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateMovementDto)
  items!: CreateMovementDto[];
}

/** Signalement en masse : même motif pour chaque mouvement. */
export class BulkFlagMovementDto extends BulkIdsDto {
  @ApiProperty({
    description: 'Motif du signalement (1000 caractères max)',
    example: 'Quantité reçue inférieure à la quantité déclarée',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
