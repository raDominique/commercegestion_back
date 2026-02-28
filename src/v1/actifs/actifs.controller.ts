import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { ActifsService } from './actifs.service';
import { Auth } from '../auth';

@ApiTags('Actifs')
@Controller()
export class ActifsController {
  constructor(private readonly actifsService: ActifsService) {}

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Récupérer un actif spécifique' })
  findOne(@Param('id') id: string) {
    return this.actifsService.findOne(id);
  }
}
 