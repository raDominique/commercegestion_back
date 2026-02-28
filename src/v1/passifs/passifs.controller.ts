import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PassifsService } from './passifs.service';
import { Auth } from '../auth';

@ApiTags('Passifs')
@Controller()
export class PassifsController {
  constructor(private readonly passifsService: PassifsService) {}

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
