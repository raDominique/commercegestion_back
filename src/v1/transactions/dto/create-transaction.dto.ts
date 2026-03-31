import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsPositive, Min } from 'class-validator';
import { TransactionType } from '../transactions.schema';

export class CreateDepositDto {
  @ApiProperty({
    description: 'ID de l\'utilisateur déposant (initiator)',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  initiatorId: string;

  @ApiProperty({
    description: 'ID de l\'utilisateur recevant le dépôt',
    example: '69989c5cdff25ef7fe0a4611',
  })
  @IsMongoId()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({
    description: 'ID du produit à déposer',
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'ID du site d\'origine (où on prend le produit)',
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsMongoId()
  @IsNotEmpty()
  originSiteId: string;

  @ApiProperty({
    description: 'ID du site de destination',
    example: '69989c5cdff25ef7fe0a4612',
  })
  @IsMongoId()
  @IsNotEmpty()
  destinationSiteId: string;

  @ApiProperty({
    description: 'Quantité à déposer',
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
