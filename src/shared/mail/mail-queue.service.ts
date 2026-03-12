import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

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
 * Job interne enrichi avec les métadonnées d'exécution.
 */
interface MailJob {
  payload: MailJobPayload;
  resolve: () => void;
  reject: (err: unknown) => void;
  attempts: number;
}

/**
 * Service dédié à la gestion de la file d'attente d'emails.
 *
 * Responsabilités :
 * - Envoi séquentiel avec délai configurable (MAIL_SEND_DELAY_MS)
 * - Retry automatique avec backoff exponentiel (MAIL_MAX_RETRIES)
 * - Drain propre de la file à l'arrêt du module (OnModuleDestroy)
 * - Observabilité via getter `queueSize` et logs structurés
 */
@Injectable()
export class MailQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MailQueueService.name);

  /** Délai (ms) entre chaque envoi pour respecter les rate limits SMTP */
  private readonly sendDelayMs: number;

  /** Nombre de tentatives max en cas d'échec SMTP */
  private readonly maxRetries: number;

  /** File d'attente des jobs */
  private readonly queue: MailJob[] = [];

  /** Indique si le worker de la queue est actif */
  private isProcessing = false;

  /** Drapeaux pour l'arrêt propre */
  private isShuttingDown = false;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.sendDelayMs = parseInt(
      this.configService.get<string>('MAIL_SEND_DELAY_MS') ?? '300',
      10,
    );
    this.maxRetries = parseInt(
      this.configService.get<string>('MAIL_MAX_RETRIES') ?? '3',
      10,
    );
  }

  // ─── Observabilité ──────────────────────────────────────────────────────────

  /** Nombre de jobs en attente dans la file */
  get queueSize(): number {
    return this.queue.length;
  }

  // ─── API publique ────────────────────────────────────────────────────────────

  /**
   * Ajoute un email en file d'attente.
   * La Promise résolue indique que l'email a été traité (envoyé ou épuisé en retries).
   * Elle ne rejette jamais : les erreurs sont loggées et absorbées pour ne pas crasher l'appelant.
   */
  enqueue(payload: MailJobPayload): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn(
        `[MailQueue] Module en cours d'arrêt, email ignoré pour ${payload.to}`,
      );
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ payload, resolve, reject, attempts: 0 });
      this.logger.debug(
        `[MailQueue] Email enqueued pour ${payload.to} (${payload.template}) — taille queue: ${this.queue.length}`,
      );
      void this.processQueue();
    });
  }

  // ─── Cycle de vie ────────────────────────────────────────────────────────────

  /**
   * Appelé par NestJS à l'arrêt du module.
   * Attend que la file courante soit vidée avant de fermer.
   */
  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.isProcessing) {
      this.logger.log(
        '[MailQueue] Arrêt demandé — attente du vidage de la file…',
      );
      await this.waitUntilEmpty();
    }
    this.logger.log('[MailQueue] File vidée, arrêt propre.');
  }

  // ─── Worker interne ──────────────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    // Un seul worker à la fois
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await this.processJob(job);

      // Délai entre les envois pour respecter le rate limit SMTP
      if (this.queue.length > 0) {
        await this.sleep(this.sendDelayMs);
      }
    }

    this.isProcessing = false;
  }

  private async processJob(job: MailJob): Promise<void> {
    const { payload } = job;

    while (job.attempts <= this.maxRetries) {
      try {
        await this.mailerService.sendMail({
          to: payload.to,
          subject: payload.subject,
          template: payload.template,
          context: payload.context,
        });
        this.logger.log(
          `[MailQueue] ✓ Email envoyé à ${payload.to} (${payload.template})`,
        );
        job.resolve();
        return;
      } catch (err: unknown) {
        job.attempts++;
        const isLastAttempt = job.attempts > this.maxRetries;

        if (isLastAttempt) {
          this.logger.error(
            `[MailQueue] ✗ Échec définitif [${payload.template}] → ${payload.to} après ${this.maxRetries + 1} tentatives`,
            err instanceof Error ? err.stack : String(err),
          );
          // On resolve (et non reject) pour ne pas crasher l'appelant
          job.resolve();
          return;
        }

        // Backoff exponentiel : 1s, 2s, 4s, …
        const delay = 1000 * Math.pow(2, job.attempts - 1);
        this.logger.warn(
          `[MailQueue] Tentative ${job.attempts}/${this.maxRetries} échouée pour ${payload.to}. Retry dans ${delay}ms…`,
        );
        await this.sleep(delay);
      }
    }
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  private waitUntilEmpty(): Promise<void> {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!this.isProcessing && this.queue.length === 0) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
}
