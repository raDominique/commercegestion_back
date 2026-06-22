import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class CreateExchangeOfferDto {
  @ApiProperty({ description: 'Produit A mis en vente (vendu)', example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  productAId!: string;

  @ApiProperty({ description: 'Quantité de produit A mise en vente', example: 10 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantiteA!: number;

  @ApiProperty({ description: 'Détenteur W du produit A (chez qui le produit est déposé)', example: '69989c5cdff25ef7fe0a4611' })
  @IsMongoId()
  @IsNotEmpty()
  detentaireAId!: string;

  @ApiProperty({ description: 'Site/dépôt de W où le produit A est stocké', example: '69989c5cdff25ef7fe0a4610' })
  @IsMongoId()
  @IsNotEmpty()
  depotAId!: string;

  @ApiProperty({ description: 'Produit B de contrepartie demandé', example: '69989c5cdff25ef7fe0a4620' })
  @IsMongoId()
  @IsNotEmpty()
  productBId!: string;

  @ApiProperty({ description: 'Taux d’échange: quantité de B pour 1 unité de A', example: 2 })
  @IsNumber()
  @IsPositive()
  @Min(0.000001)
  tauxEchange!: number;

  @ApiProperty({
    description: 'Liste des détenteurs Y acceptés pour fournir le produit B (IDs utilisateurs)',
    example: ['69989c5cdff25ef7fe0a4701', '69989c5cdff25ef7fe0a4702'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  acceptedDetenteurBIds?: string[];
}

export class BuyExchangeOfferDto {
  @ApiProperty({ description: 'Quantité de produit A à acheter', example: 3 })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  quantiteA!: number;
}
