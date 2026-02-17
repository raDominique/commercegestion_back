import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Nom de la catégorie', example: 'Électronique' })
  catName: string;

  @ApiProperty({
    description: 'Description de la catégorie',
    example: 'Catégorie regroupant tous les produits électroniques',
  })
  catDescription?: string;

  @ApiProperty({
    description: 'URL de la miniature de la catégorie',
    example: 'https://example.com/cat-miniature.jpg',
  })
  catMiniatureUrl?: string;
}
