import { PartialType } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSiteDto extends PartialType(CreateSiteDto) {
  @ApiPropertyOptional({
    example: 'Site Analakely',
    description: 'Nom du site',
  })
  @IsOptional()
  @IsString()
  siteName?: string;

  @ApiPropertyOptional({
    example: 'Analakely, Antananarivo',
    description: 'Adresse du site',
  })
  @IsOptional()
  @IsString()
  siteAddress?: string;

  @ApiPropertyOptional({ example: -18.8792, description: 'Latitude du site' })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  siteLat?: number;

  @ApiPropertyOptional({ example: 47.5079, description: 'Longitude du site' })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  siteLng?: number;
}
