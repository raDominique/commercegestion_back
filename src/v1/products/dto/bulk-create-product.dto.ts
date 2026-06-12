import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkProductItemDto {
  @ApiProperty({
    description: 'Code CPC du produit',
    example: '01111',
  })
  @IsString()
  @IsNotEmpty()
  codeCPC: string;

  @ApiProperty({
    description: 'Nom commercial du produit',
    example: 'Blé dur de qualité',
  })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiPropertyOptional({
    description: 'Description détaillée',
    example: 'Blé dur récolté en 2025',
  })
  @IsString()
  @IsOptional()
  productDescription?: string;

  @ApiPropertyOptional({
    description: 'Libellé catégorie (déduit du CPC si omis)',
    example: 'Céréales',
  })
  @IsString()
  @IsOptional()
  productCategory?: string;

  @ApiPropertyOptional({
    description: 'URL de l\'image à télécharger',
    example: 'https://example.com/image.jpg',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Volume', example: '1000 L' })
  @IsString()
  @IsOptional()
  productVolume?: string;

  @ApiPropertyOptional({ description: 'Hauteur', example: '1.2 m' })
  @IsString()
  @IsOptional()
  productHauteur?: string;

  @ApiPropertyOptional({ description: 'Largeur', example: '0.8 m' })
  @IsString()
  @IsOptional()
  productLargeur?: string;

  @ApiPropertyOptional({ description: 'Longueur', example: '0.8 m' })
  @IsString()
  @IsOptional()
  productLongueur?: string;

  @ApiPropertyOptional({ description: 'Poids', example: '500 kg' })
  @IsString()
  @IsOptional()
  productPoids?: string;
}

export class BulkCreateProductDto {
  @ApiProperty({
    description: 'Liste des produits à créer en masse',
    type: [BulkProductItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkProductItemDto)
  items: BulkProductItemDto[];
}
