import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { MovementType } from '../stock-movement.schema';

export class CreateMovementDto {
  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f', description: "Site de départ (null si dépôt initial)" })
  @IsMongoId()
  @IsOptional() // Optionnel car pour un DEPOT initial, il n'y a pas forcément d'origine système
  siteOrigineId?: string;

  @ApiProperty({ example: '69989c5cdff25ef7fe0a4610', description: "Site d'arrivée" })
  @IsMongoId()
  @IsNotEmpty()
  siteDestinationId: string;

  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  quantite: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  prixUnitaire: number;

  // --- AJOUTS POUR LA LOGIQUE AYANT-DROIT / DETENTAIRE ---

  @ApiProperty({
    required: false,
    example: '69989c5cdff25ef7fe0a4611',
    description: "Le gardien physique (Hangar, Transporteur, ou Soi-même)",
  })
  @IsMongoId()
  @IsOptional()
  detentaireId?: string;

  @ApiProperty({
    required: false,
    example: '69989c5cdff25ef7fe0a4612',
    description: "Le nouveau propriétaire (en cas de VIREMENT / Etape 4c)",
  })
  @IsMongoId()
  @IsOptional()
  ayant_droit?: string;

  @ApiProperty({ required: false, example: 'Cession de stock suite étape 4c' })
  @IsOptional()
  @IsString()
  observations?: string;
}