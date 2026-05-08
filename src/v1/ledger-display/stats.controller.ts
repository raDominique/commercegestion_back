import { Auth } from '../auth';
import { LedgerDisplayService } from './ledger-display.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import {
  Controller,
  Get,
  BadRequestException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

@ApiTags('Tableau de bord')
@Controller('dashboard')
export class StatsController {
  constructor(private readonly ledgerDisplayService: LedgerDisplayService) {}

  @Get('actifs-and-passifs')
  @Auth()
  @ApiOperation({
    summary: 'Statistiques des actifs et passifs pour un utilisateur',
    description: 'Statistiques des actifs et passifs pour un utilisateur',
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
  async getActifsAndPassifsStats(
    @Req() req: Request & { user: { userId: string } },
  ): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
  }> {
    if (!req.user.userId) {
      throw new UnauthorizedException('user id is not defined');
    }
    const result = await this.ledgerDisplayService.getActifsAndPassifsStats(
      req.user.userId,
    );
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs pour l'utilisateur ${req.user.userId}`,
      data: result,
    } as any;
  }

  @Get('actifs-and-passifs-by-site')
  @Auth()
  @ApiOperation({
    summary: 'Statistiques des actifs et passifs par site pour un utilisateur',
    description:
      'Statistiques des actifs et passifs par site pour un utilisateur',
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
    @Req() req: Request & { user: { userId: string } },
  ): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
  }> {
    if (!req.user.userId) {
      throw new UnauthorizedException('user id is not defined');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsStatsBySite(
        req.user.userId,
      );
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs par site pour l'utilisateur ${req.user.userId}`,
      data: result,
    } as any;
  }

  @Get('actifs-and-passifs-by-product')
  @Auth()
  @ApiOperation({
    summary:
      'Statistiques des actifs et passifs par produit pour un utilisateur',
    description:
      'Statistiques des actifs et passifs par produit pour un utilisateur',
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
    @Req() req: Request & { user: { userId: string } },
  ): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
  }> {
    if (!req.user.userId) {
      throw new UnauthorizedException('user id is not defined');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsStatsByProduct(
        req.user.userId,
      );
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs par produit pour l'utilisateur ${req.user.userId}`,
      data: result,
    } as any;
  }

  @Get('actifs-and-passifs-with-details-by-product')
  @Auth()
  @ApiOperation({
    summary:
      'Statistiques des actifs et passifs avec détails par produit pour un utilisateur',
    description:
      'Statistiques des actifs et passifs avec détails par produit pour un utilisateur',
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
    @Req() req: Request & { user: { userId: string } },
  ): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
    actifsDetails: any[];
    passifsDetails: any[];
  }> {
    if (!req.user.userId) {
      throw new UnauthorizedException('user id is not defined');
    }
    const result =
      await this.ledgerDisplayService.getActifsAndPassifsWithDetailsByProduct(
        req.user.userId,
      );
    return {
      status: 'success',
      message: `Statistiques des actifs et passifs avec détails par produit pour l'utilisateur ${req.user.userId}`,
      data: result,
    } as any;
  }
}
