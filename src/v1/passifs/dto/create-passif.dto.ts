import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePassifDto {
  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  userId: string; // ID de l'utilisateur propriétaire

  @ApiProperty({ example: '69989c5cdff25ef7fe0a4610' })
  @IsMongoId()
  @IsNotEmpty()
  depotId: string; // ID du site d'où provient le passif

  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string; // ID du produit

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(1)
  quantite: number; // Quantité retraitée

  @ApiProperty({
    enum: ['Retrait', 'Vente', 'Perte', 'Autre'],
    example: 'Retrait',
    required: false,
  })
  @IsEnum(['Retrait', 'Vente', 'Perte', 'Autre'])
  @IsOptional()
  reason?: string; // Raison du passif
}
