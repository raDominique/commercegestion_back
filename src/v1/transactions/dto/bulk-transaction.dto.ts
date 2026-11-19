import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateDepositDto,
  CreateInitializationDto,
  CreateReturnDto,
  CreateVenteDto,
  CreateVirementDroitDto,
} from './create-transaction.dto';
import { BULK_MAX_ITEMS, BulkIdsDto } from '../../../shared/bulk';

export class BulkCreateDepositDto {
  @ApiProperty({
    type: [CreateDepositDto],
    description: `Liste des dépôts à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateDepositDto)
  items!: CreateDepositDto[];
}

export class BulkCreateReturnDto {
  @ApiProperty({
    type: [CreateReturnDto],
    description: `Liste des retraits à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnDto)
  items!: CreateReturnDto[];
}

export class BulkCreateInitializationDto {
  @ApiProperty({
    type: [CreateInitializationDto],
    description: `Liste des initialisations à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateInitializationDto)
  items!: CreateInitializationDto[];
}

export class BulkCreateVirementDroitDto {
  @ApiProperty({
    type: [CreateVirementDroitDto],
    description: `Liste des virements de droit à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateVirementDroitDto)
  items!: CreateVirementDroitDto[];
}

export class BulkCreateVenteDto {
  @ApiProperty({
    type: [CreateVenteDto],
    description: `Liste des ventes à créer (1 à ${BULK_MAX_ITEMS})`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateVenteDto)
  items!: CreateVenteDto[];
}

/** Approbation en masse : l'approbateur est l'utilisateur authentifié. */
export class BulkApproveTransactionsDto extends BulkIdsDto {
  @ApiProperty({
    description: 'Observations appliquées à chaque transaction',
    required: false,
  })
  @IsOptional()
  @IsString()
  observations?: string;
}

/** Rejet en masse : même motif pour chaque transaction. */
export class BulkRejectTransactionsDto extends BulkIdsDto {
  @ApiProperty({ description: 'Raison du rejet', example: 'Stock insuffisant' })
  @IsNotEmpty()
  @IsString()
  motifRejet!: string;
}
