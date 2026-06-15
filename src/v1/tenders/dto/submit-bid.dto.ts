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
    description: "Identifiant unique de l'appel d'offres auquel vous répondez",
  })
  @IsMongoId()
  @IsNotEmpty()
  appelOffreId: string;

  @ApiProperty({
    example: 99.99,
    description:
      "Prix unitaire proposé pour le produit (Hors Taxes ou TTC selon l'appel)",
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  prixUnitaire: number;

  @ApiProperty({
    example: 100,
    description: 'Quantité totale que vous êtes capable de fournir',
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  quantite: number;

  @ApiProperty({
    example: 'Livraison sous 10 jours ouvrés',
    description: 'Votre délai de livraison estimé',
    required: false,
  })
  @IsString()
  @IsOptional()
  delaiLivraison?: string;

  @ApiProperty({
    example: 'Produit certifié BIO, origine locale.',
    description: 'Toute information complémentaire pertinente pour votre offre',
    required: false,
  })
  @IsString()
  @IsOptional()
  observations?: string;
}
