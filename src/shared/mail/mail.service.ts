import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async verificationAccountUser(to: string, name: string, link: string) {
    return this.mailerService.sendMail({
      to,
      subject: 'Vérification de votre compte',
      template: 'verificationAccountUser',
      context: { name, link },
    });
  }

  async notificationCompteAverifier(to: string, name: string) {
    return this.mailerService.sendMail({
      to,
      subject: 'Compte à vérifier',
      template: 'notificationCompteAverifier',
      context: { name },
    });
  }

  async notificationAdminNouveauUser(
    to: string,
    username: string,
    email: string,
  ) {
    return this.mailerService.sendMail({
      to,
      subject: 'Nouveau utilisateur enregistré',
      template: 'notificationAdminNouveauUser',
      context: { username, email },
    });
  }

  async notificationAccountUserActive(to: string, name: string) {
    return this.mailerService.sendMail({
      to,
      subject: 'Votre compte est maintenant actif',
      template: 'notificationAccountUserActive',
      context: { name },
    });
  }
}
