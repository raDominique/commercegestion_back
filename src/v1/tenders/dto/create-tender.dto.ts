import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsDateString,
} from 'class-validator';

export class CreateTenderDto {
  @ApiProperty({
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
    description: 'ID du produit concerné',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: "Appel d'offres pour la livraison de produits",
    description: "Titre de l'appel d'offres",
  })
  @IsString()
  @IsNotEmpty()
  titre: string;

  @ApiProperty({
    example: 'Description détaillée du besoin (incluant les TDR)',
    description: 'Description détaillée du besoin (incluant les TDR)',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: 100,
    description: 'Quantité totale recherchée',
    minimum: 0.01,
  })
  @IsNumber()
  quantite: number;

  @ApiProperty({
    example: 'kg',
    description: 'Unité de mesure (kg, tonne, pièce...)',
    required: false,
  })
  @IsString()
  @IsOptional()
  unite?: string;

  @ApiProperty({
    example: '2023-12-31T23:59:59Z',
    description: 'Date limite de soumission (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  dateLimite: string;

  @ApiProperty({
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
    description: 'ID du site de livraison',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  siteLivraison?: string;

  @ApiProperty({
    example: 'Conditions de paiement',
    description: 'Conditions de paiement',
    required: false,
  })
  @IsString()
  @IsOptional()
  conditionsPaiement?: string;

  @ApiProperty({
    example: 'Délai de livraison souhaité',
    description: 'Délai de livraison souhaité',
    required: false,
  })
  @IsString()
  @IsOptional()
  delaiLivraisonSouhaite?: string;
}
