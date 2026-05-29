import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateShopItemDto {
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @IsMongoId()
  @IsNotEmpty()
  siteId: string;

  @IsMongoId()
  @IsOptional()
  actifId?: string;

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  quantite: number;

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  prixUnitaire: number;

  @IsString()
  @IsOptional()
  description?: string;
}
