import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import {
  MailJob,
  MailJobDocument,
  MailJobStatus,
} from './schemas/mail-job.schema';

/**
 * Payload d'un job d'email dans la file d'attente.
 */
export interface MailJobPayload {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

/**
 * Statistiques agrégées de la file d'attente.
 */
export interface MailQueueStats {
  pending: number;
  sending: number;
  sentLast24h: number;
  failedLast24h: number;
  maxRetries: number;
}

/**
 * Service dédié à la gestion de la file d'attente d'emails.
 *
 * Responsabilités :
 * - File d'attente **durable** : les jobs sont persistés dans MongoDB,
 *   les emails en attente survivent aux redémarrages du process.
 * - Reprise automatique au démarrage (jobs restés en `sending` après un crash).
 * - Envoi séquentiel avec délai configurable (MAIL_SEND_DELAY_MS)
 * - Retry automatique avec backoff exponentiel (MAIL_MAX_RETRIES)
 * - Alerte admin en cas d'échec définitif
 * - Drain propre de la file à l'arrêt du module (OnModuleDestroy)
 * - Observabilité via `getStats()` et logs structurés
 */
@Injectable()
export class MailQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailQueueService.name);

  /** Délai (ms) entre chaque envoi pour respecter les rate limits SMTP */
  private readonly sendDelayMs: number;

  /** Nombre de tentatives max en cas d'échec SMTP */
  private readonly maxRetries: number;

  /** Email admin pour les alertes d'échec */
  private readonly adminEmail: string | undefined;

  private readonly appName: string;

  /** Indique si le worker de la queue est actif */
  private isProcessing = false;

  /** Drapeaux pour l'arrêt propre */
  private isShuttingDown = false;

  /** Compteur mémoire des jobs en attente (observabilité) */
  private pendingCount = 0;

  /** Timer pour relancer le worker sur les retries différés */
  private checkTimer?: NodeJS.Timeout;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @InjectModel(MailJob.name)
    private readonly mailJobModel: Model<MailJobDocument>,
  ) {
    this.sendDelayMs = parseInt(
      this.configService.get<string>('MAIL_SEND_DELAY_MS') ?? '300',
      10,
    );
    this.maxRetries = parseInt(
      this.configService.get<string>('MAIL_MAX_RETRIES') ?? '3',
      10,
    );
    this.adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    this.appName =
      this.configService.get<string>('APP_NAME') ?? 'Votre Application';
  }

  async onModuleInit(): Promise<void> {
    // Récupération après crash : les jobs bloqués en 'sending' repassent en 'pending'
    await this.mailJobModel
      .updateMany(
        { status: MailJobStatus.SENDING },
        { $set: { status: MailJobStatus.PENDING, nextAttemptAt: new Date() } },
      )
      .exec();
    this.pendingCount = await this.mailJobModel
      .countDocuments({ status: MailJobStatus.PENDING })
      .exec();
    if (this.pendingCount > 0) {
      this.logger.log(
        `[MailQueue] Reprise de ${this.pendingCount} email(s) resté(s) en attente.`,
      );
    }
    void this.processQueue();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = undefined;
    }
    if (this.isProcessing) {
      this.logger.log(
        '[MailQueue] Arrêt demandé — attente du vidage de la file…',
      );
      await this.waitUntilEmpty();
    }
    this.logger.log('[MailQueue] File vidée, arrêt propre.');
  }

  // ─── Observabilité ──────────────────────────────────────────────────────────

  /** Nombre de jobs en attente (persistés en base) */
  get queueSize(): number {
    return this.pendingCount;
  }

  /** Statistiques de la file pour le monitoring */
  async getStats(): Promise<MailQueueStats> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pending, sending, sentLast24h, failedLast24h] = await Promise.all([
      this.mailJobModel
        .countDocuments({ status: MailJobStatus.PENDING })
        .exec(),
      this.mailJobModel
        .countDocuments({ status: MailJobStatus.SENDING })
        .exec(),
      this.mailJobModel
        .countDocuments({
          status: MailJobStatus.SENT,
          sentAt: { $gte: since24h },
        })
        .exec(),
      this.mailJobModel
        .countDocuments({
          status: MailJobStatus.FAILED,
          updatedAt: { $gte: since24h },
        })
        .exec(),
    ]);
    return {
      pending,
      sending,
      sentLast24h,
      failedLast24h,
      maxRetries: this.maxRetries,
    };
  }

  // ─── API publique ────────────────────────────────────────────────────────────

  /**
   * Ajoute un email en file d'attente (persisté en base).
   * La Promise résolue indique que l'email a été accepté dans la file.
   * Elle ne rejette jamais : les erreurs sont loggées et absorbées pour ne pas crasher l'appelant.
   */
  async enqueue(payload: MailJobPayload): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn(
        `[MailQueue] Module en cours d'arrêt, email ignoré pour ${payload.to}`,
      );
      return;
    }

    if (!this.isValidEmail(payload.to)) {
      this.logger.warn(
        `[MailQueue] Destinataire invalide, email ignoré: ${payload.to}`,
      );
      return;
    }

    try {
      await this.mailJobModel.create({
        to: payload.to,
        subject: payload.subject,
        template: payload.template,
        context: payload.context,
        status: MailJobStatus.PENDING,
        attempts: 0,
        maxRetries: this.maxRetries,
        nextAttemptAt: new Date(),
      });
      this.pendingCount++;
      this.logger.log(
        `[MailQueue] Email enqueued pour ${payload.to} (${payload.template}) — taille queue: ${this.pendingCount}`,
      );
      void this.processQueue();
    } catch (error) {
      this.logger.error(
        `[MailQueue] Échec de persistance du job pour ${payload.to}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // ─── Cycle de vie interne ────────────────────────────────────────────────────

  /** Résout le prochain job dû, le passe atomiquement en 'sending' */
  private async claimNextJob(): Promise<MailJobDocument | null> {
    return this.mailJobModel
      .findOneAndUpdate(
        {
          status: MailJobStatus.PENDING,
          nextAttemptAt: { $lte: new Date() },
        },
        { $set: { status: MailJobStatus.SENDING } },
        { sort: { createdAt: 1 }, new: true },
      )
      .exec();
  }

  private async processQueue(): Promise<void> {
    // Un seul worker à la fois
    if (this.isProcessing) return;
    if (this.isShuttingDown) return;
    this.isProcessing = true;

    try {
      while (!this.isShuttingDown) {
        const job = await this.claimNextJob();
        if (!job) break;

        await this.processJob(job);

        // Délai entre les envois pour respecter le rate limit SMTP
        if (!this.isShuttingDown) {
          await this.sleep(this.sendDelayMs);
        }
      }
    } finally {
      this.isProcessing = false;
      await this.scheduleNextCheck();
    }
  }

  private async processJob(job: MailJobDocument): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: job.to,
        subject: job.subject,
        template: job.template,
        context: job.context,
      });
      job.status = MailJobStatus.SENT;
      job.sentAt = new Date();
      job.lastError = undefined;
      await job.save();
      this.pendingCount = Math.max(0, this.pendingCount - 1);
      this.logger.log(
        `[MailQueue] ✓ Email envoyé à ${job.to} (${job.template})`,
      );
    } catch (err: unknown) {
      job.attempts += 1;
      const isLastAttempt = job.attempts > job.maxRetries;
      const errMsg = err instanceof Error ? err.message : String(err);

      if (isLastAttempt) {
        job.status = MailJobStatus.FAILED;
        job.lastError = errMsg;
        await job.save();
        this.pendingCount = Math.max(0, this.pendingCount - 1);
        this.logger.error(
          `[MailQueue] ✗ Échec définitif [${job.template}] → ${job.to} après ${job.maxRetries + 1} tentatives : ${errMsg}`,
          err instanceof Error ? err.stack : undefined,
        );
        await this.alertAdmin(job, errMsg);
        return;
      }

      // Backoff exponentiel : 1s, 2s, 4s, …
      const delay = 1000 * Math.pow(2, job.attempts - 1);
      job.status = MailJobStatus.PENDING;
      job.lastError = errMsg;
      job.nextAttemptAt = new Date(Date.now() + delay);
      await job.save();
      this.logger.warn(
        `[MailQueue] Tentative ${job.attempts}/${job.maxRetries} échouée pour ${job.to} (${job.template}) : ${errMsg}. Retry dans ${delay}ms…`,
      );
    }
  }

  /**
   * Programme la reprise du worker si des retries différés sont en attente.
   */
  private async scheduleNextCheck(): Promise<void> {
    if (this.isShuttingDown || this.checkTimer) return;

    const next = await this.mailJobModel
      .findOne({
        status: MailJobStatus.PENDING,
        nextAttemptAt: { $gt: new Date() },
      })
      .sort({ nextAttemptAt: 1 })
      .select('nextAttemptAt')
      .lean()
      .exec();

    if (!next?.nextAttemptAt) return;

    const delay = Math.max(
      new Date(next.nextAttemptAt).getTime() - Date.now() + 100,
      1000,
    );
    this.checkTimer = setTimeout(() => {
      this.checkTimer = undefined;
      void this.processQueue();
    }, delay);
    this.checkTimer.unref?.();
  }

  /**
   * Alerte un admin en cas d'échec définitif d'envoi (email direct, hors file).
   */
  private async alertAdmin(job: MailJobDocument, error: string): Promise<void> {
    if (!this.adminEmail) return;
    try {
      await this.mailerService.sendMail({
        to: this.adminEmail,
        subject: `[ALERTE] Échec d'envoi d'email - ${this.appName}`,
        html: `<p>L'envoi de l'email suivant a échoué définitivement après ${
          job.maxRetries + 1
        } tentatives :</p>
          <ul>
            <li><b>Destinataire :</b> ${job.to}</li>
            <li><b>Template :</b> ${job.template}</li>
            <li><b>Sujet :</b> ${job.subject}</li>
            <li><b>Erreur :</b> ${error}</li>
          </ul>
          <p>Vérifiez la configuration SMTP / DNS (SPF, DKIM).</p>`,
      });
      this.logger.warn(`[MailQueue] Alerte échec envoyée à ${this.adminEmail}`);
    } catch (alertError) {
      this.logger.error(
        `[MailQueue] Impossible d'envoyer l'alerte admin: ${
          alertError instanceof Error ? alertError.message : alertError
        }`,
      );
    }
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────────

  private isValidEmail(email: string): boolean {
    return (
      typeof email === 'string' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitUntilEmpty(): Promise<void> {
    while (true) {
      if (!this.isProcessing) {
        const remaining = await this.mailJobModel
          .countDocuments({
            status: { $in: [MailJobStatus.PENDING, MailJobStatus.SENDING] },
          })
          .exec();
        if (remaining === 0) break;
      }
      await this.sleep(200);
    }
  }
}
