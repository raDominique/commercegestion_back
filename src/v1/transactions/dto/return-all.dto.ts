import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Filtres de l'aperçu du retrait intégral (query string). */
export class WithdrawableQueryDto {
  @ApiProperty({
    description:
      "Détenteur chez qui tout retirer (son propre id pour l'auto-retrait)",
    example: '69989c5cdff25ef7fe0a460f',
  })
  @IsMongoId()
  @IsNotEmpty()
  detentaireId!: string;

  @ApiPropertyOptional({
    description: "Limiter à un site d'origine",
    example: '69989c5cdff25ef7fe0a4610',
  })
  @IsOptional()
  @IsMongoId()
  siteId?: string;

  @ApiPropertyOptional({
    description: 'Limiter à un produit',
    example: '69989c5cdff25ef7fe0a4620',
  })
  @IsOptional()
  @IsMongoId()
  productId?: string;
}

/** Body du retrait intégral par détenteur. */
export class ReturnAllDto extends WithdrawableQueryDto {
  @ApiProperty({
    description: 'Site où la marchandise retirée sera détenue',
    example: '69989c5cdff25ef7fe0a4612',
  })
  @IsMongoId()
  @IsNotEmpty()
  siteDestinationId!: string;

  @ApiPropertyOptional({
    description: 'Observations appliquées à chaque retrait',
  })
  @IsOptional()
  @IsString()
  observations?: string;
}
