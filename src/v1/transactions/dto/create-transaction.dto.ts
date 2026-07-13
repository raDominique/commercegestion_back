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

export class CreateVirementDroitDto {
  @ApiProperty({
    description: 'ID du bénéficiaire (membre Z) qui reçoit le droit',
    example: '69989c5cdff25ef7fe0a4613',
  })
  @IsMongoId()
  @IsNotEmpty()
  beneficiaryId!: string;

  @ApiProperty({
    description: 'ID du détenteur (membre Y) qui garde physiquement le produit',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  detentaireId!: string;

  @ApiProperty({
    description: 'ID du site du détenteur (où le produit est déposé)',
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteId!: string;

  @ApiProperty({
    description: 'ID du produit',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Quantité à virer', example: 10 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantite!: number;

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

export class CreateVenteDto {
  @ApiProperty({
    description: 'ID du vendeur',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  vendeurId!: string;

  @ApiProperty({
    description: 'ID du produit',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    description: "ID du site d'origine (site du vendeur)",
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId!: string;

  @ApiProperty({
    description: "ID du site de destination (site de l'acheteur)",
    example: '69989c5cdff25ef7fe0a4612',
  })
  @IsMongoId()
  @IsOptional()
  siteDestinationId?: string;

  @ApiProperty({ description: 'Quantité à acheter', example: 100 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantite!: number;

  @ApiProperty({
    description:
      "Produit de contrepartie reçu en échange (optionnel, null = vente monétaire). " +
      "Ex: si j'achète du Riz avec du Maïs, la contrepartie est le Maïs.",
    required: false,
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsOptional()
  @IsMongoId()
  contrepartieId?: string;

  @ApiProperty({
    description:
      "Rapport d'échange (remplace le prix unitaire). " +
      "Quantité de contrepartie pour 1 unité du produit acheté. " +
      "Ex: 500 FCFA/unité si vente monétaire, ou 2 (kg de Maïs pour 1 kg de Riz) si échange.",
    example: 500,
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  rapportEchange!: number;

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
