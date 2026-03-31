import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailQueueService } from './mail-queue.service';

/**
 * Service métier d'envoi d'emails.
 *
 * Responsabilité unique : construire le payload (destinataire, sujet, template, contexte)
 * et le déléguer au MailQueueService pour l'envoi différé et le rate limiting.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appName: string;
  private readonly appUrl: string;
  private readonly frontUrl: string;

  constructor(
    private readonly mailQueue: MailQueueService,
    private readonly configService: ConfigService,
  ) {
    this.appName =
      this.configService.get<string>('APP_NAME') ?? 'Votre Application';
    this.appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    this.frontUrl =
      this.configService.get<string>('FRONT_URL') ?? 'http://localhost:3000';
  }

  /* =========================================================================
   * AUTH / USER
   * ========================================================================= */

  async verificationAccountUser(to: string, name: string, link: string) {
    await this.mailQueue.enqueue({
      to,
      subject: `Vérifiez votre compte - ${this.appName}`,
      template: 'email-verification',
      context: { name, link, appName: this.appName },
    });
  }

  async notificationCompteAverifier(to: string, name: string) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre compte est en cours de vérification - ${this.appName}`,
      template: 'account-pending',
      context: {
        name,
        supportLink: `${this.appUrl}/support`,
        appName: this.appName,
      },
    });
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
    await this.mailQueue.enqueue({
      to,
      subject: `Nouvel utilisateur enregistré - ${this.appName}`,
      template: 'admin-new-user',
      context: {
        username,
        email,
        userId: userId ?? 'N/A',
        userType: userType ?? 'Non défini',
        registrationDate: registrationDate
          ? registrationDate.toLocaleString('fr-FR')
          : new Date().toLocaleString('fr-FR'),
        ipAddress: ipAddress ?? 'Non disponible',
        adminPanelLink: `${this.appUrl}/admin/users/${userId}`,
        usersListLink: `${this.appUrl}/admin/users`,
        appName: this.appName,
      },
    });
  }

  async notificationAccountUserActive(
    to: string,
    name: string,
    loginLink?: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre compte est maintenant actif - ${this.appName}`,
      template: 'account-activated',
      context: {
        name,
        loginLink: loginLink ?? `${this.frontUrl}/login`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationAccountDeactivated(
    to: string,
    name: string,
    reason?: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre compte a été désactivé - ${this.appName}`,
      template: 'account-deactivated',
      context: {
        name,
        reason: reason ?? 'Non spécifiée',
        supportLink: `${this.appUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationProfileUpdated(
    to: string,
    name: string,
    changes: string[],
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre profil a été mis à jour - ${this.appName}`,
      template: 'profile-updated',
      context: { name, changes: changes.join(', '), appName: this.appName },
    });
  }

  async sendParrainValidationEmail(
    to: string,
    filleulName: string,
    validationLink: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: 'Validation de parrainage requise',
      template: 'parrain-validation',
      context: { filleulName, validationLink, appName: this.appName },
    });
  }

  /* =========================================================================
   * SITE NOTIFICATIONS
   * ========================================================================= */

  async notificationUserSitePrincipal(to: string, name: string) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre site a été créé - ${this.appName}`,
      template: 'site-principal-created',
      context: { name, appName: this.appName },
    });
  }

  async notificationUserSiteUpdate(to: string, siteName?: string) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre site a été mis à jour - ${this.appName}`,
      template: 'site-updated',
      context: { siteName: siteName ?? 'Votre site', appName: this.appName },
    });
  }

  async notificationUserSiteDelete(to: string, siteName?: string) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre site a été supprimé - ${this.appName}`,
      template: 'site-deleted',
      context: { siteName: siteName ?? 'Votre site', appName: this.appName },
    });
  }

  /* =========================================================================
   * PRODUCTS NOTIFICATIONS
   * ========================================================================= */

  async notificationProductCreated(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Produit créé et en attente de validation - ${this.appName}`,
      template: 'product-created',
      context: {
        userName,
        productName,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationProductValidated(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre produit a été validé - ${this.appName}`,
      template: 'product-validated',
      context: {
        userName,
        productName,
        dashboardLink: `${this.frontUrl}/products`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationProductUpdated(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre produit a été mis à jour - ${this.appName}`,
      template: 'product-updated',
      context: {
        userName,
        productName,
        dashboardLink: `${this.frontUrl}/products`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationProductDeleted(
    to: string,
    userName: string,
    productName: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Votre produit a été supprimé - ${this.appName}`,
      template: 'product-deleted',
      context: {
        userName,
        productName,
        dashboardLink: `${this.frontUrl}/products`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  /* =========================================================================
   * PASSWORD RESET
   * ========================================================================= */

  async sendPasswordResetEmail(to: string, username: string, resetLink: string) {
    await this.mailQueue.enqueue({
      to,
      subject: `Réinitialisation de votre mot de passe - ${this.appName}`,
      template: 'password-reset',
      context: {
        username,
        resetLink,
        expirationTime: '24 heures',
        appName: this.appName,
      },
    });
  }

  /* =========================================================================
   * STOCK MOVEMENTS NOTIFICATIONS
   * ========================================================================= */

  async notificationMovementFlagged(
    to: string,
    recipientName: string,
    siteName: string,
    productName: string,
    quantity: number,
    reason: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Mouvement de stock signalé comme invalide - ${this.appName}`,
      template: 'movement-flagged',
      context: {
        recipientName,
        siteName,
        productName,
        quantity,
        reason,
        currentDate: new Date().toLocaleString('fr-FR'),
        dashboardLink: `${this.frontUrl}/stock`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  /* =========================================================================
   * TRANSACTION NOTIFICATIONS
   * ========================================================================= */

  async notificationTransactionCreated(
    to: string,
    recipientName: string,
    transactionType: string,
    productName: string,
    quantity: number,
    transactionNumber: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Nouvelle transaction créée - ${this.appName}`,
      template: 'transaction-created',
      context: {
        recipientName,
        transactionType,
        productName,
        quantity,
        transactionNumber,
        currentDate: new Date().toLocaleString('fr-FR'),
        dashboardLink: `${this.frontUrl}/transactions`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationTransactionApproved(
    to: string,
    recipientName: string,
    transactionType: string,
    productName: string,
    quantity: number,
    transactionNumber: string,
    approverName: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Transaction approuvée - ${this.appName}`,
      template: 'transaction-approved',
      context: {
        recipientName,
        transactionType,
        productName,
        quantity,
        transactionNumber,
        approverName,
        currentDate: new Date().toLocaleString('fr-FR'),
        dashboardLink: `${this.frontUrl}/transactions`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
  }

  async notificationTransactionRejected(
    to: string,
    recipientName: string,
    transactionType: string,
    productName: string,
    quantity: number,
    transactionNumber: string,
    rejectionReason: string,
    approverName: string,
  ) {
    await this.mailQueue.enqueue({
      to,
      subject: `Transaction rejetée - ${this.appName}`,
      template: 'transaction-rejected',
      context: {
        recipientName,
        transactionType,
        productName,
        quantity,
        transactionNumber,
        rejectionReason,
        approverName,
        currentDate: new Date().toLocaleString('fr-FR'),
        dashboardLink: `${this.frontUrl}/transactions`,
        supportLink: `${this.frontUrl}/support`,
        appName: this.appName,
      },
    });
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
    await this.mailQueue.enqueue({
      to,
      subject,
      template,
      context: { ...context, appName: this.appName },
    });
  }
}
