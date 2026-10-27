import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface FailedAttemptEntry {
  count: number;
  lockUntil: number;
}

interface TOTPUsedEntry {
  codes: Set<string>;
  lastCleanup: number;
}

@Injectable()
export class AuthSecurityService {
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private failedAttemptsStore = new Map<string, FailedAttemptEntry>();
  private usedTotpCodes = new Map<string, TOTPUsedEntry>();

  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly RATE_LIMIT_MAX = 5;
  private readonly MAX_FAILED_ATTEMPTS = 3;
  private readonly LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  checkRateLimit(key: string): void {
    const now = Date.now();
    const entry = this.rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW,
      });
      return;
    }

    if (entry.count >= this.RATE_LIMIT_MAX) {
      const remainingMs = entry.resetTime - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new HttpException(
        `Trop de tentatives. Veuillez réessayer dans ${remainingMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
  }

  checkLockout(key: string): void {
    const now = Date.now();
    const entry = this.failedAttemptsStore.get(key);

    if (entry && now < entry.lockUntil) {
      const remainingMs = entry.lockUntil - now;
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new HttpException(
        `Compte temporairement verrouillé. Veuillez réessayer dans ${remainingMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailedAttempt(key: string): void {
    const now = Date.now();
    const entry = this.failedAttemptsStore.get(key);

    if (!entry || now > entry.lockUntil) {
      this.failedAttemptsStore.set(key, {
        count: 1,
        lockUntil: now + this.LOCK_DURATION,
      });
      return;
    }

    entry.count++;
    if (entry.count >= this.MAX_FAILED_ATTEMPTS) {
      entry.lockUntil = now + this.LOCK_DURATION;
    }
  }

  resetFailedAttempts(key: string): void {
    this.failedAttemptsStore.delete(key);
  }

  checkAndRecordTotpCode(userId: string, code: string): void {
    const now = Date.now();
    const entry = this.usedTotpCodes.get(userId);

    if (!entry) {
      this.usedTotpCodes.set(userId, {
        codes: new Set([code]),
        lastCleanup: now,
      });
      return;
    }

    // Cleanup old entries every hour
    if (now - entry.lastCleanup > 60 * 60 * 1000) {
      entry.codes.clear();
      entry.lastCleanup = now;
    }

    if (entry.codes.has(code)) {
      throw new HttpException(
        'Code TOTP déjà utilisé',
        HttpStatus.UNAUTHORIZED,
      );
    }

    entry.codes.add(code);
  }
}
