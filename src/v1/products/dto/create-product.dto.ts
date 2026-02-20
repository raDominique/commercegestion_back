import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Code officiel de la nomenclature CPC',
    example: '01111',
  })
  @IsString()
  @IsNotEmpty()
  codeCPC: string;

  @ApiProperty({
    description: 'Nom commercial ou spécifique du produit',
    example: 'Blé dur de qualité supérieure',
  })
  @IsString()
  @IsNotEmpty()
  productName: string;

  @ApiPropertyOptional({
    description: 'Description détaillée du produit',
    example: 'Blé dur récolté en 2025, teneur en humidité < 12%',
  })
  @IsString()
  @IsOptional()
  productDescription?: string;

  @ApiProperty({
    description: 'ID MongoDB de la catégorie CPC correspondante',
    example: '65dcf1234567890abcdef123',
  })
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    description: 'Libellé textuel de la catégorie',
    example: 'Céréales',
  })
  @IsString()
  @IsNotEmpty()
  productCategory: string;

  @ApiProperty({
    description: 'État physique du produit',
    enum: ['Brut', 'Transformé', 'Conditionné'],
    example: 'Brut',
  })
  @IsEnum(['Brut', 'Transformé', 'Conditionné'])
  @IsOptional()
  productState?: string;

  @ApiPropertyOptional({ description: 'Volume total', example: '1000 L' })
  @IsString()
  @IsOptional()
  productVolume?: string;

  @ApiPropertyOptional({ description: 'Hauteur unitaire', example: '1.2 m' })
  @IsString()
  @IsOptional()
  productHauteur?: string;

  @ApiPropertyOptional({ description: 'Largeur unitaire', example: '0.8 m' })
  @IsString()
  @IsOptional()
  productLargeur?: string;

  @ApiPropertyOptional({ description: 'Longueur unitaire', example: '0.8 m' })
  @IsString()
  @IsOptional()
  productLongueur?: string;

  @ApiPropertyOptional({
    description: 'Poids total ou unitaire',
    example: '500 kg',
  })
  @IsString()
  @IsOptional()
  productPoids?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Image du produit',
  })
  @IsOptional()
  image?: any;
}
