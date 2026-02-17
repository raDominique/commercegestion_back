import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCpcDto } from './create-cpc.dto';

export class BulkCreateCpcDto {
    @ApiProperty({ type: [CreateCpcDto], description: 'Liste des CPC à créer' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCpcDto)
    items: CreateCpcDto[];
}
