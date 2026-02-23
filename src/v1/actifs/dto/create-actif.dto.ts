import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreateActifDto {
  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  userId: string; // ID de l'utilisateur propriétaire

  @ApiProperty({ example: '69989c5cdff25ef7fe0a4610' })
  @IsMongoId()
  @IsNotEmpty()
  depotId: string; // ID du site où est stocké le produit

  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string; // ID du produit

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(1)
  quantite: number; // Quantité en stock
}
