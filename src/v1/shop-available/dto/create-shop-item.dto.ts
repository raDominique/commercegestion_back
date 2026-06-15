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

export class CreateShopItemDto {
  @IsMongoId()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID du produit à vendre',
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
  })
  productId: string;

  @IsMongoId()
  @IsNotEmpty()
  @ApiProperty({
    description: 'ID du site où le produit est disponible',
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
  })
  siteId: string;

  @IsMongoId()
  @IsOptional()
  @ApiProperty({
    description:
      "ID de l'actif à vendre (optionnel, mais recommandé pour vérifier la quantité)",
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
  })
  actifId?: string;

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  @ApiProperty({
    description: 'Quantité du produit à vendre',
    example: 10,
  })
  quantite: number;

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  @ApiProperty({
    description: 'Prix unitaire du produit',
    example: 99.99,
  })
  prixUnitaire: number;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: "Description optionnelle de l'annonce",
    example: 'Vente de 10 unités du produit X en excellent état.',
  })
  description?: string;
}
