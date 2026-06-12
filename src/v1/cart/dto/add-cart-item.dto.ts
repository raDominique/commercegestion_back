import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty({
    description: 'ID du shop item (ShopAvailable)',
    example: '65dcf1234567890abcdef123',
  })
  @IsMongoId()
  @IsNotEmpty()
  shopItemId: string;

  @ApiProperty({ description: 'Quantité demandée', example: 10 })
  @IsNumber()
  @IsPositive()
  @Min(1)
  quantite: number;
}
