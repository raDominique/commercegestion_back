import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';

import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../auth';

import { DashboardService } from './dashboard.service';

@ApiTags('Stats Dashboard')
@Controller('stats-dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Auth()
  @ApiOperation({
    summary: 'Dashboard complet utilisateur',
    description: 'Retourne toutes les statistiques et graphiques du dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard récupéré avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié',
  })
  async getDashboard(
    @Req()
    req: Request & {
      user: {
        userId: string;
        userAccess: string;
      };
    },
  ) {
    if (!req.user.userId) {
      throw new UnauthorizedException('user id is not defined');
    }

    const result = await this.dashboardService.getDashboard(
      req.user.userId,
      req.user.userAccess,
    );

    return {
      status: 'success',
      message: `Dashboard récupéré avec succès`,
      data: result,
    };
  }
}
