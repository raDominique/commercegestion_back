import { Controller, Get, Post, Body, Param, Patch, Delete, Query, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CpcService } from './cpc.service';
import { CreateCpcDto } from './dto/create-cpc.dto';
import { UpdateCpcDto } from './dto/update-cpc.dto';
import { Auth } from '../auth';
import { FileInterceptor } from '@nestjs/platform-express';
import { BulkCreateCpcDto } from './dto/bulk-create-cpc.dto';

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

  @Get('get-by-code/:code')
  @ApiOperation({ summary: 'Obtenir un produit par son code' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie CPC (ex: 01111)' })
  @ApiResponse({ status: 200, description: 'Catégorie trouvée.' })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée.' })
  findOne(@Param('code') code: string) {
    return this.service.findOne(code);
  }

  @Get('get-children/:code')
  @ApiOperation({ summary: 'Lister les sous-catégories directes' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie parente' })
  findChildren(@Param('code') code: string) {
    return this.service.findChildren(code);
  }

  @Patch('update/:code')
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

  @Delete('delete/:code')
  @ApiOperation({ summary: 'Supprimer un code' })
  @ApiParam({ name: 'code', description: 'Code de la catégorie à supprimer' })
  @ApiResponse({ status: 200, description: 'Catégorie supprimée avec succès.' })
  @Auth()
  remove(@Param('code') code: string, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.service.delete(code, userId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Importer un fichier CSV de CPC' })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @Auth()
  async importCpc(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.service.importCpcProduct(file, userId);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exporter tous les CPC en CSV' })
  async exportCpc() {
    const fileUrl = await this.service.exportCpc();
    return { status: 'success', file: fileUrl };
  }

  @Post('bulk-create')
  @ApiOperation({ summary: 'Créer plusieurs CPC en une seule requête' })
  @ApiBody({ type: BulkCreateCpcDto })
  @ApiResponse({ status: 201, description: 'CPC créés avec succès' })
  @Auth()
  async bulkCreate(@Body() dto: BulkCreateCpcDto, @Req() req: any) {
    const userId = req.user?.id || 'system';
    return this.service.bulkCreate(dto, userId);
  }
}