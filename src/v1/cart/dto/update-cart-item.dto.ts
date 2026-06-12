import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({ description: 'Nouvelle quantité', example: 5 })
  @IsNumber()
  @IsPositive()
  @Min(1)
  quantite: number;
}
