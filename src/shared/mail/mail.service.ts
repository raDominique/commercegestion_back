import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly frontUrl: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.appName =
      this.configService.get<string>('APP_NAME') || 'Votre Application';
    this.appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    this.frontUrl =
      this.configService.get<string>('FRONT_URL') || 'http://localhost:3000';
  }

  /* =========================================================================
   * AUTH / USER
   * ========================================================================= */

  async verificationAccountUser(to: string, name: string, link: string) {
    await this.sendMailSafe(
      to,
      `Vérifiez votre compte - ${this.appName}`,
      'email-verification',
      { name, link },
    );
  }

  async notificationCompteAverifier(to: string, name: string) {
    await this.sendMailSafe(
      to,
      `Votre compte est en cours de vérification - ${this.appName}`,
      'account-pending',
      {
        name,
        supportLink: `${this.appUrl}/support`,
      },
    );
  }

  async notificationAdminNouveauUser(
    to: string,
    username: string,
    email: string,
    userId?: string,
    userType?: string,
    registrationDate?: Date,
    ipAddress?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Nouvel utilisateur enregistré - ${this.appName}`,
        template: 'admin-new-user',
        context: {
          username,
          email,
          userId: userId || 'N/A',
          userType: userType || 'Non défini',
          registrationDate: registrationDate
            ? registrationDate.toLocaleString('fr-FR')
            : new Date().toLocaleString('fr-FR'),
          ipAddress: ipAddress || 'Non disponible',
          adminPanelLink: `${this.appUrl}/admin/users/${userId}`,
          usersListLink: `${this.appUrl}/admin/users`,
          appName: this.appName,
        },
      });
      this.logger.log(`Email admin nouvel utilisateur envoyé à ${to}`);
    } catch (error) {
      this.logger.error(`Erreur email admin nouvel utilisateur`, error.stack);
    }
  }

  async notificationAccountUserActive(
    to: string,
    name: string,
    loginLink?: string,
  ) {
    await this.sendMailSafe(
      to,
      `Votre compte est maintenant actif - ${this.appName}`,
      'account-activated',
      {
        name,
        loginLink: loginLink || `${this.frontUrl}/login`,
        supportLink: `${this.frontUrl}/support`,
      },
    );
  }

  async notificationAccountDeactivated(
    to: string,
    name: string,
    reason?: string,
  ) {
    await this.sendMailSafe(
      to,
      `Votre compte a été désactivé - ${this.appName}`,
      'account-deactivated',
      {
        name,
        reason: reason || 'Non spécifiée',
        supportLink: `${this.appUrl}/support`,
      },
    );
  }

  async notificationProfileUpdated(
    to: string,
    name: string,
    changes: string[],
  ) {
    await this.sendMailSafe(
      to,
      `Votre profil a été mis à jour - ${this.appName}`,
      'profile-updated',
      {
        name,
        changes: changes.join(', '),
      },
    );
  }

  async sendParrainValidationEmail(
    to: string,
    filleulName: string,
    validationLink: string,
  ) {
    await this.mailerService.sendMail({
      to,
      subject: 'Validation de parrainage requise',
      template: './parrain-validation',
      context: {
        filleulName,
        validationLink,
      },
    });
  }

  /* =========================================================================
   * SITE NOTIFICATIONS (UTILISÉES PAR NotifyHelper)
   * ========================================================================= */

  /** 🔹 Création site principal */
  async notificationUserSitePrincipal(to: string, name: string) {
    await this.sendMailSafe(
      to,
      `Votre site a été créé - ${this.appName}`,
      'site-principal-created',
      { name },
    );
  }

  /** 🔹 Mise à jour site */
  async notificationUserSiteUpdate(to: string, siteName?: string) {
    await this.sendMailSafe(
      to,
      `Votre site a été mis à jour - ${this.appName}`,
      'site-updated',
      {
        siteName: siteName || 'Votre site',
      },
    );
  }

  /** 🔹 Suppression site */
  async notificationUserSiteDelete(to: string, siteName?: string) {
    await this.sendMailSafe(
      to,
      `Votre site a été supprimé - ${this.appName}`,
      'site-deleted',
      {
        siteName: siteName || 'Votre site',
      },
    );
  }

  /* =========================================================================
   * PRODUCTS NOTIFICATIONS
   * ========================================================================= */

  /** 🔹 Notification création produit en attente de validation */
  async notificationProductCreated(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.sendMailSafe(
      to,
      `Produit créé et en attente de validation - ${this.appName}`,
      'product-created',
      {
        userName,
        productName,
        supportLink: `${this.frontUrl}/support`,
      },
    );
  }

  /** 🔹 Notification validation produit */
  async notificationProductValidated(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.sendMailSafe(
      to,
      `Votre produit a été validé - ${this.appName}`,
      'product-validated',
      {
        userName,
        productName,
        dashboardLink: `${this.frontUrl}/products`,
        supportLink: `${this.frontUrl}/support`,
      },
    );
  }

  /** 🔹 Notification mise à jour produit */
  async notificationProductUpdated(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.sendMailSafe(
      to,
      `Votre produit a été mis à jour - ${this.appName}`,
      'product-updated',
      {
        userName,
        productName,
        dashboardLink: `${this.frontUrl}/products`,
        supportLink: `${this.frontUrl}/support`,
      },
    );
  }

  /** 🔹 Notification suppression produit */
  async notificationProductDeleted(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.sendMailSafe(
      to,
      `Votre produit a été supprimé - ${this.appName}`,
      'product-deleted',
      {
        userName,
        productName,
        dashboardLink: `${this.frontUrl}/products`,
        supportLink: `${this.frontUrl}/support`,
      },
    );
  }

  /* =========================================================================
   * PASSWORD RESET
   * ========================================================================= */

  async sendPasswordResetEmail(
    to: string,
    username: string,
    resetLink: string,
  ) {
    await this.sendMailSafe(
      to,
      `Réinitialisation de votre mot de passe - ${this.appName}`,
      'password-reset',
      {
        username,
        resetLink,
        expirationTime: '24 heures',
      },
    );
  }

  /* =========================================================================
   * EMAIL GÉNÉRIQUE
   * ========================================================================= */

  async sendCustomEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
  ) {
    await this.sendMailSafe(to, subject, template, context);
  }

  /* =========================================================================
   * PRIVATE HELPER (ANTI-CRASH)
   * ========================================================================= */

  private async sendMailSafe(
    to: string,
    subject: string,
    template: string,
    context: Record<string, any>,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context: {
          ...context,
          appName: this.appName,
        },
      });
      this.logger.log(`Email envoyé à ${to} (${template})`);
    } catch (error) {
      this.logger.error(
        `Erreur envoi email [${template}] vers ${to}`,
        error.stack,
      );
    }
  }
}
