import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@ApiTags('Mail')
@Controller('mail')
export class MailController {
  constructor(private readonly mailService: MailService) {}

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
}
