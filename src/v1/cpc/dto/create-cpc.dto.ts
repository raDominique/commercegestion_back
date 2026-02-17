import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional, IsObject } from 'class-validator';

export class CreateCpcDto {
    @ApiProperty({
        example: '01111',
        description: 'Code unique de la classification'
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        example: 'Blé dur',
        description: 'Nom de la catégorie de produit'
    })
    @IsString()
    @IsNotEmpty()
    nom: string;

    @ApiProperty({
        example: 'sous-classe',
        enum: ['section', 'division', 'groupe', 'classe', 'sous-classe'],
        description: 'Niveau hiérarchique dans la CPC'
    })
    @IsString()
    @IsNotEmpty()
    niveau: string;

    @ApiPropertyOptional({
        example: '0111',
        description: 'Code du parent direct'
    })
    @IsString()
    @IsOptional()
    parentCode?: string;

    @ApiPropertyOptional({
        example: ['0', '01', '011', '0111'],
        description: 'Liste des codes ancêtres pour la navigation'
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    ancetres?: string[];

    @ApiPropertyOptional({
        example: { sh: '1001.10', citi: '0111' },
        description: 'Correspondances avec d\'autres nomenclatures'
    })
    @IsObject()
    @IsOptional()
    correspondances?: Record<string, any>;
}