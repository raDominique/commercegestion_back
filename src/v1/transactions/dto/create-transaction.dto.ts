import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsPositive, Min, IsString } from 'class-validator';
import { TransactionType } from '../transactions.schema';

export class CreateDepositDto {
  @ApiProperty({
    description: 'ID du site d\'origine (où on prend le produit)',
    example: '69a4adc345bcd6536ab0b749',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId: string;

  @ApiProperty({
    description: 'ID du site de destination',
    example: '69a4adc345bcd6536ab0b749',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteDestinationId: string;

  @ApiProperty({
    description: 'ID du produit à déposer',
    example: '69ac7bad367d4fe50671403a',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Quantité à déposer',
    example: 500000,
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantite: number;

  @ApiProperty({
    description: 'ID du détentaire (qui garde physiquement l\'actif)',
    example: '69b51cd15862f4d57f398f23',
  })
  @IsMongoId()
  @IsNotEmpty()
  detentaire: string;

  @ApiProperty({
    description: 'ID de l\'ayant-droit (qui possède légalement l\'actif)',
    example: '69b53e71d809b2695cd97a37',
  })
  @IsMongoId()
  @IsNotEmpty()
  ayant_droit: string;

  @ApiProperty({
    description: 'Prix unitaire du produit',
    example: 45000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiProperty({
    description: 'Observations ou notes sur le dépôt',
    example: 'bn cvnbcnb',
    required: false,
  })
  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreateReturnDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur qui retourne le produit',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  initiatorId: string;

  @ApiProperty({
    description: 'ID de l\'utilisateur propriétaire du produit (ayant-droit)',
    example: '69989c5cdff25ef7fe0a4611',
  })
  @IsMongoId()
  @IsNotEmpty()
  ayantDroitId: string;

  @ApiProperty({
    description: 'ID du produit à retourner',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'ID du site d\'origine (où est le produit actuellement)',
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  originSiteId: string;

  @ApiProperty({
    description: 'ID du site de destination (où on retourne le produit)',
    example: '69989c5cdff25ef7fe0a4612',
  })
  @IsMongoId()
  @IsNotEmpty()
  destinationSiteId: string;

  @ApiProperty({
    description: 'Quantité à retourner',
    example: 500,
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: 'Prix unitaire du produit',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class CreateInitializationDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur qui initialise le stock',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  initiatorId: string;

  @ApiProperty({
    description: 'ID du produit à initialiser',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'ID du site d\'initialisation',
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteId: string;

  @ApiProperty({
    description: 'Quantité initiale',
    example: 1000,
  })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: 'Prix unitaire du produit',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;
}

export class ApproveTransactionDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur qui approuve',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  approverUserId: string;

  @ApiProperty({
    description: 'Notes additionnelles (facultatif)',
    example: 'Dépôt conforme',
    required: false,
  })
  @IsOptional()
  notes?: string;
}

export class RejectTransactionDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur qui rejette',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  approverUserId: string;

  @ApiProperty({
    description: 'Raison du rejet',
    example: 'Produit défectueux',
  })
  @IsNotEmpty()
  @IsOptional()
  rejectionReason: string;
}
