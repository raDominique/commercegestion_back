import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';
import { MailDeliverabilityService } from './mail-deliverability.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(
    private readonly mailService: MailService,
    private readonly mailQueueService: MailQueueService,
    private readonly mailDeliverabilityService: MailDeliverabilityService,
  ) {}

  @Post('test')
  @ApiOperation({ summary: 'Envoyer un email de test SMTP' })
  async sendTestEmail(@Body() dto: SendTestMailDto) {
    await this.mailService.sendTestEmail(dto.to);
    return {
      success: true,
      message:
        'Email de test mis en file d’attente. Vérifiez la boîte de réception et les logs SMTP.',
      to: dto.to,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Statistiques de la file d’emails' })
  async getStatus() {
    const stats = await this.mailQueueService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get('deliverability')
  @ApiOperation({
    summary: 'Vérifier la délivrabilité SMTP (SPF / DKIM / DMARC)',
  })
  async getDeliverability() {
    const report = await this.mailDeliverabilityService.check();
    return {
      success: true,
      data: report,
    };
  }
}
