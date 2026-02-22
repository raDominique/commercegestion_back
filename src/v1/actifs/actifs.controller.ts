import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ActifsService } from './actifs.service';
import { Auth } from '../auth';

@ApiTags('Actifs')
@Controller()
export class ActifsController {
  constructor(private readonly actifsService: ActifsService) {}

  @Get('me')
  @Auth()
  @ApiOperation({ summary: "Récupérer tous les actifs de l'utilisateur" })
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
    description: "Liste des actifs de l'utilisateur",
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé' })
  async findAll(@Req() req: any, @Query() query: any) {
    return this.actifsService.getActifsByUser(req.user.userId, query);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Récupérer un actif spécifique' })
  findOne(@Param('id') id: string) {
    return this.actifsService.findOne(id);
  }
}
