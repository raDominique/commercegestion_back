import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly adminEmail: string;
  private readonly appName: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') || 'admin@example.com';
    this.appName =
      this.configService.get<string>('APP_NAME') || 'Votre Application';
  }

  // ========================= EMAIL DE VÉRIFICATION (lors de l'inscription) =========================
  /**
   * Envoyé à l'utilisateur après l'inscription pour vérifier son email
   */
  async verificationAccountUser(to: string, name: string, link: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Vérifiez votre compte - ${this.appName}`,
        template: 'email-verification',
        context: {
          name,
          link,
          appName: this.appName,
        },
      });
      console.log(`Email de vérification envoyé à ${to}`);
    } catch (error) {
      console.error(` Erreur envoi email de vérification à ${to}:`, error);
      throw error;
    }
  }

  // ========================= NOTIFICATION COMPTE EN ATTENTE (après vérification email) =========================
  /**
   * Envoyé à l'utilisateur après qu'il ait vérifié son email
   * pour l'informer que son compte est en attente de validation admin
   */
  async notificationCompteAverifier(to: string, name: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Votre compte est en cours de vérification - ${this.appName}`,
        template: 'account-pending',
        context: {
          name,
          appName: this.appName,
          supportLink: `${this.configService.get<string>('APP_URL')}/support`,
        },
      });
      console.log(`Email compte en attente envoyé à ${to}`);
    } catch (error) {
      console.error(` Erreur envoi email compte en attente à ${to}:`, error);
      throw error;
    }
  }

  // ========================= NOTIFICATION ADMIN NOUVEAU USER (lors de l'inscription) =========================
  /**
   * Envoyé à l'admin quand un nouvel utilisateur s'inscrit
   */
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
          adminPanelLink: `${this.configService.get<string>('APP_URL')}/admin/users/${userId}`,
          usersListLink: `${this.configService.get<string>('APP_URL')}/admin/users`,
          totalUsers: '---',
          pendingUsers: '---',
          todaySignups: '---',
        },
      });
      console.log(`Email notification admin envoyé à ${to}`);
    } catch (error) {
      console.error(`Erreur envoi email notification admin à ${to}:`, error);
      // Ne pas throw pour ne pas bloquer l'inscription si l'email admin échoue
    }
  }

  // ========================= NOTIFICATION COMPTE ACTIVÉ (après validation admin) =========================
  /**
   * Envoyé à l'utilisateur quand l'admin active son compte
   */
  async notificationAccountUserActive(
    to: string,
    name: string,
    loginLink?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Votre compte est maintenant actif - ${this.appName}`,
        template: 'account-activated',
        context: {
          name,
          loginLink:
            loginLink || `${this.configService.get<string>('FRONT_URL')}/login`,
          supportLink: `${this.configService.get<string>('FRONT_URL')}/support`,
          appName: this.appName,
        },
      });
      console.log(`Email compte activé envoyé à ${to}`);
    } catch (error) {
      console.error(` Erreur envoi email compte activé à ${to}:`, error);
      throw error;
    }
  }

  // ========================= NOTIFICATION COMPTE DÉSACTIVÉ (optionnel) =========================
  /**
   * Envoyé à l'utilisateur quand son compte est désactivé/supprimé
   */
  async notificationAccountDeactivated(
    to: string,
    name: string,
    reason?: string,
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Votre compte a été désactivé - ${this.appName}`,
        template: 'account-deactivated',
        context: {
          name,
          reason: reason || 'Non spécifiée',
          supportLink: `${this.configService.get<string>('APP_URL')}/support`,
          appName: this.appName,
        },
      });
      console.log(`Email compte désactivé envoyé à ${to}`);
    } catch (error) {
      console.error(` Erreur envoi email compte désactivé à ${to}:`, error);
    }
  }

  // ========================= NOTIFICATION MISE À JOUR PROFIL (optionnel) =========================
  /**
   * Envoyé à l'utilisateur quand son profil est mis à jour
   */
  async notificationProfileUpdated(
    to: string,
    name: string,
    changes: string[],
  ) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Votre profil a été mis à jour - ${this.appName}`,
        template: 'profile-updated',
        context: {
          name,
          changes: changes.join(', '),
          appName: this.appName,
        },
      });
      console.log(`Email mise à jour profil envoyé à ${to}`);
    } catch (error) {
      console.error(`Erreur envoi email mise à jour profil à ${to}:`, error);
    }
  }

  // ========================= EMAIL GÉNÉRIQUE (pour usages personnalisés) =========================
  /**
   * Méthode générique pour envoyer des emails personnalisés
   */
  async sendCustomEmail(
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
      console.log(`Email personnalisé envoyé à ${to}`);
    } catch (error) {
      console.error(`Erreur envoi email personnalisé à ${to}:`, error);
      throw error;
    }
  }
}