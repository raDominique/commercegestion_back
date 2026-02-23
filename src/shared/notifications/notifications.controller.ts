import { Controller, Get, Query, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Auth } from 'src/v1/auth';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Notifications')
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Auth()
  @ApiOperation({
    description:
      "Récupère l'historique des notifications pour l'utilisateur connecté.",
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page pour la pagination (par défaut: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre de notifications par page (par défaut: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Recherche textuelle dans les titres/messages des notifications',
    example: 'stock',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des notifications récupérée avec succès.',
  })
  @ApiResponse({
    status: 401,
    description: "Non autorisé. L'utilisateur doit être authentifié.",
  })
  @ApiResponse({ status: 500, description: 'Erreur interne du serveur.' })
  async historiques(@Req() req: any, @Query() query: any) {
    return this.notificationsService.getUserNotifications(
      req.user.userId,
      query,
    );
  }
}
