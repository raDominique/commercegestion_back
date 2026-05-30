import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class SubmitBidDto {
  @ApiProperty({
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
    description: "ID de l'appel d'offres",
  })
  @IsMongoId()
  @IsNotEmpty()
  appelOffreId: string;

  @ApiProperty({
    example: 99.99,
    description: 'Prix unitaire proposé',
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  prixUnitaire: number;

  @ApiProperty({ example: 100, description: 'Quantité offerte', minimum: 0.01 })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  quantite: number;

  @ApiProperty({
    example: 'Délai de livraison proposé',
    description: 'Délai de livraison proposé',
    required: false,
  })
  @IsString()
  @IsOptional()
  delaiLivraison?: string;

  @ApiProperty({
    example: 'Observations / commentaires',
    description: 'Observations / commentaires',
    required: false,
  })
  @IsString()
  @IsOptional()
  observations?: string;
}
