import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  IsString,
} from 'class-validator';

export class CreateDepositDto {
  @ApiProperty({
    description: "ID du site d'origine",
    example: '69a4adc345bcd6536ab0b749',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId!: string;

  @ApiProperty({
    description: 'ID du site de destination',
    example: '69a4adc345bcd6536ab0b749',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteDestinationId!: string;

  @ApiProperty({
    description: 'ID du produit à déposer',
    example: '69ac7bad367d4fe50671403a',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Quantité à déposer', example: 500000 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantite!: number;

  @ApiProperty({
    description: 'ID du détentaire',
    example: '69b51cd15862f4d57f398f23',
  })
  @IsMongoId()
  @IsNotEmpty()
  detentaire!: string;

  @ApiProperty({
    description: "ID de l'ayant-droit",
    example: '69b53e71d809b2695cd97a37',
  })
  @IsMongoId()
  @IsNotEmpty()
  ayant_droit!: string;

  @ApiProperty({
    description: 'Prix unitaire',
    example: 45000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiProperty({
    description: 'Observations',
    example: 'Note...',
    required: false,
  })
  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreateReturnDto {
  @ApiProperty({
    description: 'ID du détentaire qui retourne',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  detentaire!: string;

  @ApiProperty({
    description: "ID de l'ayant-droit",
    example: '69989c5cdff25ef7fe0a4611',
  })
  @IsMongoId()
  @IsNotEmpty()
  ayant_droit!: string;

  @ApiProperty({
    description: 'ID du produit',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: "ID du site d'origine",
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId!: string;

  @ApiProperty({
    description: 'ID du site de destination',
    example: '69989c5cdff25ef7fe0a4612',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteDestinationId!: string;

  @ApiProperty({ description: 'Quantité à retourner', example: 500 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantite!: number;

  @ApiProperty({ description: 'Prix unitaire', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiProperty({ description: 'Observations', required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreateInitializationDto {
  @ApiProperty({
    description: 'ID du produit',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: "ID du site d'initialisation",
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId!: string;

  @ApiProperty({ description: 'Quantité initiale', example: 1000 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantite!: number;

  @ApiProperty({ description: 'Prix unitaire', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiProperty({ description: 'Observations', required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}

export class ApproveTransactionDto {
  @ApiProperty({
    description: "ID de l'approbateur",
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  approuveurId!: string;

  @ApiProperty({ description: 'Observations', required: false })
  @IsOptional()
  @IsString()
  observations?: string;
}

export class RejectTransactionDto {
  @ApiProperty({
    description: 'ID de celui qui rejette',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  approuveurId!: string;

  @ApiProperty({ description: 'Raison du rejet', example: 'Stock insuffisant' })
  @IsNotEmpty()
  @IsString()
  motifRejet!: string;
}
