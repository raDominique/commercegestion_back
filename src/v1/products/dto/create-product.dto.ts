import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsBoolean, IsObject } from 'class-validator';

export class CreateProductDto {
    @ApiProperty({ example: '01111', description: 'Code CPC à 5 chiffres' })
    @IsString() @IsNotEmpty()
    codeCPC: string;

    @ApiProperty({ example: 'Blé dur de qualité supérieure' })
    @IsString() @IsNotEmpty()
    productName: string;

    @ApiPropertyOptional({ example: 'Récolte 2023' })
    @IsString() @IsOptional()
    productDescription?: string;

    @ApiProperty({ enum: ['Brut', 'Transformé', 'Conditionné'], default: 'Brut' })
    @IsEnum(['Brut', 'Transformé', 'Conditionné'])
    @IsOptional()
    productState?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsArray() @IsString({ each: true }) @IsOptional()
    productImage?: string[];

    @ApiPropertyOptional()
    @IsString() @IsOptional()
    productVolume?: string;

    @ApiPropertyOptional()
    @IsString() @IsOptional()
    productPoids?: string;

    @ApiPropertyOptional()
    @IsObject() @IsOptional()
    dimensions?: { hauteur: string; largeur: string; longueur: string };

    @ApiPropertyOptional({ default: false })
    @IsBoolean() @IsOptional()
    isStocker?: boolean;
}