import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PassifsService } from './passifs.service';
import { Auth } from '../auth';

@ApiTags('Passifs')
@Controller()
export class PassifsController {
  constructor(private readonly passifsService: PassifsService) {}

  @Get('me')
  @Auth()
  @ApiOperation({ summary: "Récupérer tous les passifs de l'utilisateur" })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page (optionnel)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page (optionnel)",
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Recherche dans les champs de texte (optionnel)',
  })
  @ApiQuery({
    name: 'siteId',
    required: false,
    description: 'Filtrer par site (optionnel)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Champ de tri (optionnel)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: 'Ordre de tri (asc ou desc, optionnel)',
  })
  @ApiResponse({
    status: 200,
    description: "Liste des passifs de l'utilisateur",
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll(@Req() req: any, @Query() query: any) {
    return this.passifsService.getPassifsByUser(req.user.userId, query);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Récupérer un passif spécifique' })
  @ApiResponse({ status: 200, description: 'Passif récupéré avec succès' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findOne(@Param('id') id: string) {
    return this.passifsService.findOne(id);
  }
}
