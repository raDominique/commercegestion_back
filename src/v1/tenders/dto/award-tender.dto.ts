import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty } from 'class-validator';

export class AwardTenderDto {
  @ApiProperty({
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
    description: 'ID de la soumission retenue',
  })
  @IsMongoId()
  @IsNotEmpty()
  soumissionId: string;
}
