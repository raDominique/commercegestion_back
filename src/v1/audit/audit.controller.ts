import { Controller, Get, Req, Query, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';

@Controller('audit')
@ApiTags()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('get-all-sessions')
  @Auth()
  @ApiOperation({ summary: 'Get all audit logs for a user' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  findAllAuditByUserId(@Req() req: any) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    return this.auditService.findLogsByUserId(userId);
  }

  @Get('all')
  @Auth()
  @ApiOperation({ summary: 'Get all audit logs in the system (Admin)' })
  @ApiResponse({ status: 200, description: 'Paginated list of audit logs' })
  findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 50) {
    return this.auditService.findAllLogs(Number(page), Number(limit));
  }

  @Get('export')
  @Auth()
  @ApiOperation({ summary: 'Exporter les données en Excel ou PDF' })
  @ApiQuery({ name: 'format', required: true, enum: ['excel', 'pdf'], description: "Format d'export: excel ou pdf" })
  @ApiResponse({ status: 200, description: 'URL du fichier généré' })
  async exportAll(
    @Query('format') format: 'excel' | 'pdf',
    @Req() req: any,
  ) {
    if (!format || !['excel', 'pdf'].includes(format)) {
      throw new BadRequestException('Format invalide. Utilisez "excel" ou "pdf".');
    }
    const userId = req.user?.userId || 'system';
    const fileUrl = await this.auditService.exportAll(format, userId);
    return { status: 'success', file: fileUrl };
  }
}
