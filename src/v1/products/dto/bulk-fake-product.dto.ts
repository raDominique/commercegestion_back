import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsNotEmpty, Min, Max } from 'class-validator';

export class BulkFakeProductDto {
  @ApiProperty({
    description: 'Nombre de produits factices à générer',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  count: number;

  @ApiProperty({
    description: 'ID MongoDB du propriétaire des produits',
    example: '65dcf1234567890abcdef123',
  })
  @IsString()
  @IsNotEmpty()
  ownerId: string;
}
