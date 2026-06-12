import { Type } from 'class-transformer';
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
    description: 'ID technique du produit faisant l\'objet de l\'appel d\'offres',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: "Fourniture de 100 tonnes de Maïs jaune",
    description: "Titre clair et précis de votre besoin",
  })
  @IsString()
  @IsNotEmpty()
  titre: string;

  @ApiProperty({
    example: 'Description détaillée incluant les spécifications techniques, la qualité attendue, etc.',
    description: 'Cahier des charges ou description complète du besoin',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: 100,
    description: 'Quantité totale recherchée',
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantite: number;

  @ApiProperty({
    example: 'tonnes',
    description: 'Unité de mesure (kg, tonnes, pièces, etc.)',
    required: false,
  })
  @IsString()
  @IsOptional()
  unite?: string;

  @ApiProperty({
    example: '2023-12-31T23:59:59Z',
    description: 'Date et heure limite de réception des offres (ISO 8601)',
  })
  @IsDateString()
  @IsNotEmpty()
  dateLimite: string;

  @ApiProperty({
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
    description: 'ID du site géographique où la livraison doit être effectuée',
    required: false,
  })
  @IsMongoId()
  @IsOptional()
  siteLivraison?: string;

  @ApiProperty({
    example: 'Paiement à 30 jours après réception',
    description: 'Vos conditions de paiement souhaitées',
    required: false,
  })
  @IsString()
  @IsOptional()
  conditionsPaiement?: string;

  @ApiProperty({
    example: 'Livraison souhaitée avant le 15 du mois suivant',
    description: 'Délai de livraison idéal attendu',
    required: false,
  })
  @IsString()
  @IsOptional()
  delaiLivraisonSouhaite?: string;
}
