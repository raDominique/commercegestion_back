import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMovementDto {
  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId: string;

  @ApiProperty({ example: '69989c5cdff25ef7fe0a4610' })
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

  @ApiProperty({
    required: false,
    example: '69989c5cdff25ef7fe0a4611',
    description: "ID de l'utilisateur qui détient physiquement le produit",
  })
  @IsMongoId()
  @IsOptional()
  detentaire?: string;

  @ApiProperty({
    required: false,
    example: '69989c5cdff25ef7fe0a4612',
    description: "ID de l'utilisateur propriétaire légal",
  })
  @IsMongoId()
  @IsOptional()
  ayant_droit?: string;

  @ApiProperty({ required: false, example: 'Cession de stock ou transfert' })
  @IsOptional()
  @IsString()
  observations?: string;
}
