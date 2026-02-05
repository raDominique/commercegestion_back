import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';

@Controller('audit')
@ApiTags('Audit')
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
}
