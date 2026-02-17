import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'Site Analakely', description: 'Nom du site' })
  @IsNotEmpty()
  @IsString()
  siteName: string;

  @ApiProperty({
    example: 'Analakely, Antananarivo',
    description: 'Adresse du site',
  })
  @IsNotEmpty()
  @IsString()
  siteAddress: string;

  @ApiProperty({ example: -18.8792, description: 'Latitude du site' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  siteLat: number;

  @ApiProperty({ example: 47.5079, description: 'Longitude du site' })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  siteLng: number;
}
