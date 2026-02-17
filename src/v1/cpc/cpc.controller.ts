import { Controller, Get, Post, Body, Param, Patch, Delete, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CpcService } from './cpc.service';
import { CreateCpcDto } from './dto/create-cpc.dto';
import { UpdateCpcDto } from './dto/update-cpc.dto';
import { Auth } from '../auth';

@ApiTags('Classification CPC')
@Controller()
export class CpcController {
  constructor(private readonly service: CpcService) { }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle catégorie CPC' })
  @ApiBody({ type: CreateCpcDto })
  @ApiResponse({ status: 201, description: 'La catégorie a été créée avec succès.' })
  @ApiResponse({ status: 400, description: 'Données invalides.' })
  @Auth()
  create(@Body() dto: CreateCpcDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.service.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les produits avec pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'niveau', required: false, description: 'Filtrer par niveau hiérarchique' })
  @ApiQuery({ name: 'search', required: false, description: 'Recherche par nom' })
  @ApiResponse({ status: 200, description: 'Liste récupérée avec succès.' })
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Obtenir un produit par son code' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie CPC (ex: 01111)' })
  @ApiResponse({ status: 200, description: 'Catégorie trouvée.' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée.' })
  findOne(@Param('code') code: string) {
    return this.service.findOne(code);
  }

  @Get(':code/enfants')
  @ApiOperation({ summary: 'Lister les sous-catégories directes' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie parente' })
  findChildren(@Param('code') code: string) {
    return this.service.findChildren(code);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Modifier une catégorie' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie à modifier' })
  @ApiBody({ type: UpdateCpcDto })
  @ApiResponse({ status: 200, description: 'Catégorie mise à jour avec succès.' })
  @Auth()
  update(
    @Param('code') code: string,
    @Body() dto: UpdateCpcDto,
    @Req() req: any
  ) {
    const userId = req.user?.id || 'system';
    return this.service.update(code, dto, userId);
  }

  @Delete(':code')
  @ApiOperation({ summary: 'Supprimer un code' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie à supprimer' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée avec succès.' })
  @Auth()
  remove(@Param('code') code: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.service.delete(code, userId);
  }
}