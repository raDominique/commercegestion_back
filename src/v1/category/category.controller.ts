import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthRole } from '../auth';
import { UserAccess } from '../users/users.schema';

@ApiTags('Category')
@ApiBearerAuth() // Indique que l'authentification est requise pour certains endpoints
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Créer une catégorie (ADMIN)',
    description:
      'Permet à un administrateur de créer une nouvelle catégorie de produit. **Accès : ADMIN uniquement.**',
  })
  @ApiBody({
    description: 'Détails de la catégorie à créer',
    type: CreateCategoryDto,
    examples: {
      exemple1: {
        summary: 'Exemple de catégorie Céréales',
        value: {
          catName: 'Céréales',
          catDescription:
            'Comprend le froment (blé), le maïs et le riz non décortiqué.',
          catMiniatureUrl: 'https://example.com/images/cereales.jpg',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Catégorie créée avec succès.' })
  @ApiResponse({
    status: 403,
    description: 'Interdit - Droits ADMIN insuffisants.',
  })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoryService.create(createCategoryDto);
  }

  @Post('bulk')
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Créer plusieurs catégories (ADMIN)',
    description:
      'Permet d’importer massivement des catégories. **Accès : ADMIN uniquement.**',
  })
  @ApiBody({
    description: 'Liste de catégories à créer',
    type: [CreateCategoryDto],
    examples: {
      importMassif: {
        summary: 'Exemple de liste (CPC)',
        value: [
          {
            catName: 'Céréales',
            catDescription: 'Groupe 011 : Blé, maïs, riz.',
            catMiniatureUrl: 'https://example.com/cereales.jpg',
          },
          {
            catName: 'Légumes',
            catDescription: 'Groupe 012 : Pommes de terre et légumes frais.',
            catMiniatureUrl: 'https://example.com/legumes.jpg',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Toutes les catégories ont été créées avec succès.',
  })
  createBulk(@Body() createCategoryDtos: CreateCategoryDto[]) {
    return this.categoryService.createBulk(createCategoryDtos);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les catégories',
    description:
      'Récupère la liste paginée des catégories. Ce endpoint est accessible à tous les utilisateurs (Public).',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Numéro de la page',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Nombre d’éléments par page',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    example: 'Céréales',
    description: 'Recherche par nom ou description',
  })
  @ApiResponse({ status: 200, description: 'Retourne la liste paginée.' })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('search') search = '',
  ) {
    return this.categoryService.findAll(page, limit, search);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Détails d’une catégorie',
    description:
      'Récupère les informations détaillées d’une catégorie via son identifiant unique.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID technique de la catégorie (MongoDB ID ou UUID)',
    example: '60d0fe4f5311244630a13871',
  })
  @ApiResponse({
    status: 200,
    description: 'Données de la catégorie retournées.',
  })
  @ApiResponse({ status: 404, description: 'Catégorie introuvable.' })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Mettre à jour une catégorie (ADMIN)',
    description:
      'Modifie les informations d’une catégorie existante. **Accès : ADMIN uniquement.**',
  })
  @ApiParam({ name: 'id', description: 'ID de la catégorie à modifier' })
  @ApiBody({
    type: UpdateCategoryDto,
    examples: {
      majNom: {
        summary: 'Exemple de mise à jour du nom',
        value: { catName: 'Céréales et Grains' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour.' })
  @ApiResponse({ status: 404, description: 'ID non trouvé.' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @AuthRole(UserAccess.ADMIN)
  @ApiOperation({
    summary: 'Supprimer une catégorie (ADMIN)',
    description:
      'Supprime définitivement une catégorie de la base de données. **Accès : ADMIN uniquement.**',
  })
  @ApiParam({ name: 'id', description: 'ID de la catégorie à supprimer' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée.' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée.' })
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}
