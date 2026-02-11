import { forwardRef, Global, Inject, Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { AuditService } from 'src/v1/audit/audit.service';
import { UsersService } from 'src/v1/users/users.service';

export interface NotifyOptions {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  userId: string;
  previousState?: any;
  newState?: any;
  emailData?: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    siteName?: string;
  };
}

@Injectable()
export class NotifyHelper {
  private readonly logger = new Logger(NotifyHelper.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
  ) {}

  async notify(options: NotifyOptions) {
    const {
      action,
      entityType,
      entityId,
      userId,
      previousState,
      newState,
      emailData,
    } = options;

    // 1️⃣ Audit log
    try {
      await this.auditService.log({
        action,
        entityType,
        entityId,
        userId,
        previousState,
        newState,
      });
    } catch (auditError) {
      this.logger.error(
        `Erreur audit pour ${action} sur ${entityType} ${entityId}`,
        auditError.stack,
      );
    }

    // 2️⃣ Email notification
    try {
      const user = await this.userService.getById(userId);
      if (!user) return;

      switch (emailData?.type) {
        case 'CREATE':
          await this.mailService.notificationUserSitePrincipal(
            user.userEmail,
            user.userName ?? user.managerName ?? 'Utilisateur',
          );
          break;
        case 'UPDATE':
          await this.mailService.notificationUserSiteUpdate(
            user.userEmail,
            emailData.siteName,
          );
          break;
        case 'DELETE':
          await this.mailService.notificationUserSiteDelete(
            user.userEmail,
            emailData.siteName,
          );
          break;
      }

      this.logger.log(
        `Notification email envoyée à ${user.userEmail} pour ${emailData?.type}`,
      );
    } catch (mailError) {
      this.logger.error(
        `Erreur envoi email pour ${emailData?.type}`,
        mailError.stack,
      );
    }
  }
}
