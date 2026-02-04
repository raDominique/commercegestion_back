import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggerService extends Logger {
  debug(context: string, message: string): void {
    super.debug(`[${context}] ${message}`);
  }

  log(context: string, message: string): void {
    super.log(`[${context}] ${message}`);
  }

  error(context: string, message: string, trace?: string): void {
    super.error(`[${context}] ${message}`, trace);
  }

  warn(context: string, message: string): void {
    super.warn(`[${context}] ${message}`);
  }

  verbose(context: string, message: string): void {
    super.verbose(`[${context}] ${message}`);
  }
}
