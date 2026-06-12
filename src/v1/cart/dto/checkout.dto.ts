import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class CheckoutDto {
  @ApiPropertyOptional({
    description: "ID du site de destination (site de l'acheteur)",
    example: '65dcf1234567890abcdef456',
  })
  @IsMongoId()
  @IsOptional()
  siteDestinationId?: string;

  @ApiPropertyOptional({
    description: 'Observations générales pour la commande',
    example: 'Livraison rapide souhaitée',
  })
  @IsString()
  @IsOptional()
  observations?: string;
}
