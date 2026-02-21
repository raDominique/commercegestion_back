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
import { MovementType } from '../stock-movement.schema';

export class CreateMovementDto {
  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  @IsNotEmpty()
  siteOrigineId: string; // ID du site de départ

  @ApiProperty({ example: '69989c5cdff25ef7fe0a4610' })
  @IsMongoId()
  @IsNotEmpty()
  siteDestinationId: string; // ID du site de dépôt

  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsMongoId()
  productId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  quantite: number;

  @ApiProperty({ enum: MovementType, example: MovementType.DEPOT })
  @IsEnum(MovementType)
  type: MovementType;

  @ApiProperty({ required: false, example: 'Transfert pour réassort' })
  @IsOptional()
  @IsString()
  observations?: string;
}
