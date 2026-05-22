import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LedgerDisplayService } from '../../v1/ledger-display/ledger-display.service';

@ApiTags('Livre (V2)')
@Controller()
export class LedgerController {
  constructor(private readonly ledgerDisplayService: LedgerDisplayService) {}

  @Get('user/:userId/export')
  @ApiOperation({
    summary: "Exporter le grand livre d'un utilisateur",
    description: `Génère un fichier CSV, Excel ou PDF contenant tous les mouvements d'un utilisateur.

Exemple d'échange d'actifs entre deux membres :
- Hypothèse : Un membre X possède des euros dans une banque B1. Un membre Y possède des MGA dans une banque B2
- Le membre X vend 1000 euros pour un taux de 4.200 MGA
- Après l'échange, l'actif en euro du membre X dans la banque B1 diminue de 1.000 euros tandis que l'actif en MGA du membre X dans la banque B2 augmente de 4.200.000 MGA
- Il y a aussi des mouvements des actifs du membre Y
- Il y a aussi des mouvements des passifs du côté des banques B1 et B2`,
  })
  @ApiParam({ name: 'userId', description: "ID unique de l'utilisateur" })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'excel', 'pdf'], description: "Format d'export (défaut: csv)" })
  @ApiResponse({ status: 200, description: 'Fichier téléchargé directement' })
  async exportUserLedger(
    @Param('userId') userId: string,
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<StreamableFile> {
    if (!userId || userId.length !== 24) {
      throw new BadRequestException('Un ID utilisateur valide (24 caractères) est requis');
    }
    const result = await this.ledgerDisplayService.exportUserLedger(userId, format);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }

  @Get('global/export')
  @ApiOperation({
    summary: 'Exporter le grand livre global',
    description: 'Génère un fichier CSV, Excel ou PDF contenant tous les mouvements du système.',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'excel', 'pdf'], description: "Format d'export (défaut: csv)" })
  @ApiResponse({ status: 200, description: 'Fichier téléchargé directement' })
  async exportGlobalLedger(
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<StreamableFile> {
    const result = await this.ledgerDisplayService.exportGlobalLedger(format);
    return new StreamableFile(result.buffer, {
      type: result.mimeType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
