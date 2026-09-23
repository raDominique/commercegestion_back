import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
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

  @Patch(':notificationId/read')
  @Auth()
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  @ApiResponse({ status: 200, description: 'Notification marquée comme lue.' })
  @ApiResponse({ status: 404, description: 'Notification introuvable.' })
  async markAsRead(
    @Req() req: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(req.user.userId, notificationId);
  }

  @Patch('read-all')
  @Auth()
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  @ApiResponse({
    status: 200,
    description: 'Toutes les notifications ont été marquées comme lues.',
  })
  async markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @Get('export')
  @Auth()
  @ApiOperation({ summary: 'Exporter les données en Excel ou PDF' })
  @ApiQuery({
    name: 'format',
    required: true,
    enum: ['excel', 'pdf'],
    description: "Format d'export: excel ou pdf",
  })
  @ApiResponse({ status: 200, description: 'URL du fichier généré' })
  async exportAll(
    @Query('format') format: 'excel' | 'pdf',
    @Req() req: any,
  ): Promise<StreamableFile> {
    if (!format || !['excel', 'pdf'].includes(format)) {
      throw new BadRequestException(
        'Format invalide. Utilisez "excel" ou "pdf".',
      );
    }
    const userId = req.user?.userId || 'system';
    const result = await this.notificationsService.exportAll(format, userId);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
