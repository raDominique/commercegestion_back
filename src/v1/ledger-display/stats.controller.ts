import { Auth } from '../auth';
import { LedgerDisplayService } from './ledger-display.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Controller, Get, Param, BadRequestException } from '@nestjs/common';

@ApiTags('Tableau de bord')
@Controller('dashboard')
export class StatsController {
  constructor(private readonly ledgerDisplayService: LedgerDisplayService) {}

  @Get('actifs-and-passifs/:userId')
  @Auth()
  @ApiOperation({
    summary: 'Statistiques des actifs et passifs pour un utilisateur',
    description: 'Statistiques des actifs et passifs pour un utilisateur',
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des actifs et passifs pour un utilisateur',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé',
  })
  async getActifsAndPassifsStats(@Param('userId') userId: string): Promise<{
    actifs: number;
    passifs: number;
    valeurTotaleActifs: number;
    valeurTotalePassifs: number;
  }> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsStats(userId);
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs pour l'utilisateur ${userId}`,
      data: result,
    } as any;
  }

  @Get('actifs-and-passifs-by-site/:userId')
  @Auth()
  @ApiOperation({
    summary: 'Statistiques des actifs et passifs par site pour un utilisateur',
    description:
      'Statistiques des actifs et passifs par site pour un utilisateur',
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description:
      'Statistiques des actifs et passifs par site pour un utilisateur',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé',
  })
  async getActifsAndPassifsStatsBySite(
    @Param('userId') userId: string,
  ): Promise<{
    actifs: number;
    passifs: number;
    valeurTotaleActifs: number;
    valeurTotalePassifs: number;
  }> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsStatsBySite(userId);
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs par site pour l'utilisateur ${userId}`,
      data: result,
    } as any;
  }

  @Get('actifs-and-passifs-by-product/:userId')
  @Auth()
  @ApiOperation({
    summary:
      'Statistiques des actifs et passifs par produit pour un utilisateur',
    description:
      'Statistiques des actifs et passifs par produit pour un utilisateur',
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description:
      'Statistiques des actifs et passifs par produit pour un utilisateur',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé',
  })
  async getActifsAndPassifsStatsByProduct(
    @Param('userId') userId: string,
  ): Promise<{
    actifs: number;
    passifs: number;
    valeurTotaleActifs: number;
    valeurTotalePassifs: number;
  }> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsStatsByProduct(userId);
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs par produit pour l'utilisateur ${userId}`,
      data: result,
    } as any;
  }

  @Get('actifs-and-passifs-with-details-by-product/:userId')
  @Auth()
  @ApiOperation({
    summary:
      'Statistiques des actifs et passifs avec détails par produit pour un utilisateur',
    description:
      'Statistiques des actifs et passifs avec détails par produit pour un utilisateur',
  })
  @ApiParam({
    name: 'userId',
    description: "ID unique (MongoDB ObjectId) de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description:
      'Statistiques des actifs et passifs avec détails par produit pour un utilisateur',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({
    status: 404,
    description: 'Utilisateur non trouvé',
  })
  async getActifsAndPassifsWithDetailsByProduct(
    @Param('userId') userId: string,
  ): Promise<{
    actifs: number;
    passifs: number;
    valeurTotaleActifs: number;
    valeurTotalePassifs: number;
    actifsDetails: any[];
    passifsDetails: any[];
  }> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsWithDetailsByProduct(
        userId,
      );
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs avec détails par produit pour l'utilisateur ${userId}`,
      data: result,
    } as any;
  }
}
