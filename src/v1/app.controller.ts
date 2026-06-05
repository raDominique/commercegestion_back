import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { SendTestMailDto } from 'src/shared/mail/dto/send-test-mail.dto';
import { MailService } from 'src/shared/mail/mail.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly mailService: MailService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('upload-test')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadTest(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    return this.appService.updateAvatar(file);
  }

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
