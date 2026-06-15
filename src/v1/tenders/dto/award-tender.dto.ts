import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AwardTenderDto {
  @ApiProperty({
    example: '64b8f0c2e1d3f2a5c6b7d8e9',
    description:
      'Identifiant unique de la soumission (offre) que vous avez décidé de retenir comme gagnante',
  })
  @IsMongoId()
  @IsNotEmpty()
  soumissionId: string | undefined;

  @ApiProperty({
    example: 'Meilleur rapport qualité/prix et délai respecté.',
    description: "Commentaire ou motif de l'attribution (facultatif)",
    required: false,
  })
  @IsString()
  @IsOptional()
  commentaire?: string;
}
