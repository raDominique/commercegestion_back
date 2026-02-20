import {
  IsNotEmpty,
  IsNumber,
  IsMongoId,
  Min,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustStockDto {
  @ApiProperty({ example: '65d1...siteId' })
  @IsMongoId()
  @IsNotEmpty()
  depotId: string;

  @ApiProperty({ example: '65d1...productId' })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    example: 10,
    description: 'Positif pour entrée, négatif pour sortie',
  })
  @IsNumber()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  prix?: number;
}

export class TransferStockDto {
  @IsMongoId()
  @IsNotEmpty()
  fromSiteId: string;

  @IsMongoId()
  @IsNotEmpty()
  toSiteId: string;

  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
