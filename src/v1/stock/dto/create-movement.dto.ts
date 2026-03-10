import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateMovementDto {
  @ApiProperty({
    example: '69989c5cdff25ef7fe0a460f',
    description: 'Site de départ (null si dépôt initial)',
  })
  @IsOptional()
  siteOrigineId?: string;

  @ApiProperty({
    example: '69989c5cdff25ef7fe0a4610',
    description: "Site d'arrivée",
  })
  @IsNotEmpty()
  siteDestinationId: string;

  @ApiProperty({ example: '69989c5cdff25ef7fe0a460f' })
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  quantite: number;

  @ApiProperty({ example: 1500 })
  @IsNumber()
  @Min(0)
  prixUnitaire: number;

  @ApiProperty({
    required: false,
    example: '69989c5cdff25ef7fe0a4611',
    description: 'Le gardien physique (Hangar, Transporteur, ou Soi-même)',
  })
  @IsOptional()
  detentaire?: string;

  @ApiProperty({
    required: false,
    example: '69989c5cdff25ef7fe0a4612',
    description: 'Le nouveau propriétaire (en cas de VIREMENT / Etape 4c)',
  })
  @IsOptional()
  ayant_droit?: string;

  @ApiProperty({ required: false, example: 'Cession de stock suite étape 4c' })
  @IsOptional()
  @IsString()
  observations?: string;
}
